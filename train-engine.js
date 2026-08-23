(() => {
  'use strict';
  if (window.RailContext?.rail === 'keisei') return;

  window.TrainWatchEngineReady = (async () => {
    const response = await fetch('./data/timetable.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Timetable data load failed: ${response.status}`);
    const DATA = await response.json();

    const STATIONS = DATA.stations.map((x, i) => ({ id:x[0], name:x[1], en:x[2], i }));
    const SERVICE = Object.fromEntries(Object.entries(DATA.services).map(([key,label]) => [key,{label}]));
    const DOWN = DATA.offsets.down;
    const UP = DATA.offsets.up;
    const BASES = DATA.daytimeBases;
    const TX19_EDGE = DATA.verifiedEdgeTimes?.TX19 || null;
    const HOLIDAYS = new Set(DATA.calendar?.holidayDates || []);

    const ARRIVAL_LEAD_MS = 35_000;
    const DEPARTURE_WINDOW_MS = 60_000;
    const PASS_ACTIVE_BEFORE_MS = 10_000;
    const PASS_ACTIVE_AFTER_MS = 10_000;
    const LONG_WAIT_MS = 90 * 60_000;
    const SERVICE_DAY_BOUNDARY_HOUR = 4;

    function stationById(id){ return STATIONS.find(s=>s.id===id)||STATIONS[18]; }
    function minutes(h,m){ return h*60+m; }
    function dirText(v){ return v.dir==='down'?'つくば方面':'秋葉原方面'; }
    function isOrigin(v){ return (v.dir==='down'&&v.stationId==='TX01')||(v.dir==='up'&&v.stationId==='TX20'); }
    function isTerminal(v){ return (v.dir==='down'&&v.stationId==='TX20')||(v.dir==='up'&&v.stationId==='TX01'); }
    function fmtTime(d){ return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
    function dateKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
    function serviceDateForMoment(moment){
      const d=new Date(moment);
      if(d.getHours()<SERVICE_DAY_BOUNDARY_HOUR) d.setDate(d.getDate()-1);
      d.setHours(12,0,0,0);
      return d;
    }
    function dayTypeForMoment(moment){
      const d=serviceDateForMoment(moment);
      return [0,6].includes(d.getDay()) || HOLIDAYS.has(dateKey(d)) ? 'holiday' : 'weekday';
    }
    function fmtClock(ms){
      const s=Math.max(0,Math.ceil(ms/1000));
      return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
    }
    function fmtRemain(ms){
      const s=Math.max(0,Math.ceil(ms/1000));
      if(s<60) return `あと${s}秒`;
      if(s<3600) return `あと${Math.floor(s/60)}分${String(s%60).padStart(2,'0')}秒`;
      const h=Math.floor(s/3600), m=Math.floor((s%3600)/60);
      if(h<3) return `あと${h}時間${m?`${m}分`:''}`;
      return `約${Math.round(s/3600)}時間後`;
    }

    function targetFrom(baseMin,offset,day,extra){
      const d=new Date(day); d.setHours(0,0,0,0); d.setMinutes(baseMin+offset);
      return {...extra,stationAt:d,time:fmtTime(d)};
    }
    function interpolate(arr,index,baseline){
      if(arr[index]!=null) return {offset:arr[index],approx:false};
      let l=index-1,r=index+1;
      while(l>=0&&arr[l]==null) l--;
      while(r<arr.length&&arr[r]==null) r++;
      if(l<0||r>=arr.length) return {offset:null,approx:true};
      const p=(baseline[index]-baseline[l])/(baseline[r]-baseline[l]);
      return {offset:arr[l]+(arr[r]-arr[l])*p,approx:true};
    }

    function buildPatternVisits(now,stationId){
      const station=stationById(stationId),out=[],baseDay=new Date(now); baseDay.setHours(0,0,0,0);
      const lastHour=stationId==='TX19'?22:BASES.endHour;
      for(let h=BASES.startHour;h<=lastHour;h++){
        BASES.down.forEach(([kind,m])=>{
          const inf=interpolate(DOWN[kind],station.i,DOWN.local); if(inf.offset==null)return;
          out.push(targetFrom(minutes(h,m),inf.offset,baseDay,{
            kind,dir:'down',stationId,stop:DOWN[kind][station.i]!=null,approx:inf.approx,
            verified:false,id:`model-d-${h}-${m}-${kind}-${stationId}`
          }));
        });
        BASES.up.forEach(([kind,m])=>{
          const inf=interpolate(UP[kind],station.i,UP.local); if(inf.offset==null)return;
          out.push(targetFrom(minutes(h,m),inf.offset,baseDay,{
            kind,dir:'up',stationId,stop:UP[kind][station.i]!=null,approx:inf.approx,
            verified:false,id:`model-u-${h}-${m}-${kind}-${stationId}`
          }));
        });
      }
      return out;
    }

    function exactVisitsForDate(day,stationId){
      if(stationId!=='TX19'||!TX19_EDGE) return [];
      const out=[];
      ['up','down'].forEach(dir=>{
        const candidates=[];
        ['weekday','holiday'].forEach(dayType=>{
          (TX19_EDGE[dayType]?.[dir]||[]).forEach(([h,m,kind])=>candidates.push({dayType,h,m,kind}));
        });
        candidates.forEach(({dayType,h,m,kind})=>{
          const d=new Date(day); d.setHours(h,m,0,0);
          if(dayTypeForMoment(d)!==dayType) return;
          out.push({
            id:`verified-${dayType}-${dir}-${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}-${h}-${m}`,
            kind,dir,stationId,stop:true,approx:false,verified:true,serviceDayType:dayType,stationAt:d,time:fmtTime(d)
          });
        });
      });
      return out;
    }

    function buildExactVisits(now,stationId){
      const yesterday=new Date(now); yesterday.setDate(yesterday.getDate()-1); yesterday.setHours(0,0,0,0);
      const today=new Date(now); today.setHours(0,0,0,0);
      const tomorrow=new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
      return [...exactVisitsForDate(yesterday,stationId),...exactVisitsForDate(today,stationId),...exactVisitsForDate(tomorrow,stationId)];
    }

    function buildVisits(now,stationId){
      const out=[...buildPatternVisits(now,stationId),...buildExactVisits(now,stationId)];
      const seen=new Set();
      return out
        .filter(v=>v.stationAt-now>-90_000)
        .sort((a,b)=>a.stationAt-b.stationAt)
        .filter(v=>{
          const key=`${v.dir}-${+v.stationAt}-${v.stationId}`;
          if(seen.has(key))return false;
          seen.add(key);return true;
        });
    }

    function filterVisits(visits,filters={}){
      const includePass=filters.includePass!==false,dir=filters.dir||'both';
      return visits.filter(v=>(includePass||v.stop)&&(dir==='both'||v.dir===dir));
    }

    function focusForVisit(v,now){
      const nowMs=+now,stationMs=+v.stationAt;
      if(!v.stop){
        const delta=stationMs-nowMs;
        if(delta<-PASS_ACTIVE_AFTER_MS)return null;
        const active=delta<=PASS_ACTIVE_BEFORE_MS&&delta>=-PASS_ACTIVE_AFTER_MS;
        return {visit:v,key:`${v.id}:pass`,type:'pass',typeLabel:'通過',target:new Date(stationMs),status:active?'active':delta<=180_000?'soon':'future',deltaMs:delta,approximate:true,activeUntil:new Date(stationMs+PASS_ACTIVE_AFTER_MS)};
      }
      if(isOrigin(v)){
        const delta=stationMs-nowMs;
        if(delta<-DEPARTURE_WINDOW_MS)return null;
        return {visit:v,key:`${v.id}:departure`,type:'departure',typeLabel:'発車',target:new Date(stationMs),status:delta<=0?'active':delta<=180_000?'soon':'future',deltaMs:delta,approximate:!v.verified,activeUntil:new Date(stationMs+DEPARTURE_WINDOW_MS)};
      }
      if(isTerminal(v)){
        const delta=stationMs-nowMs;
        if(delta<-30_000)return null;
        return {visit:v,key:`${v.id}:arrival-terminal`,type:'arrival',typeLabel:'到着',target:new Date(stationMs),status:delta<=10_000?'active':delta<=180_000?'soon':'future',deltaMs:delta,approximate:!v.verified||v.approx,activeUntil:new Date(stationMs+30_000)};
      }
      const arrivalMs=stationMs-ARRIVAL_LEAD_MS;
      if(nowMs<stationMs){
        const delta=arrivalMs-nowMs;
        return {visit:v,key:`${v.id}:arrival`,type:'arrival',typeLabel:'到着',target:new Date(arrivalMs),status:delta<=0?'active':delta<=180_000?'soon':'future',deltaMs:delta,approximate:true,activeUntil:new Date(stationMs)};
      }
      if(nowMs<stationMs+DEPARTURE_WINDOW_MS){
        return {visit:v,key:`${v.id}:departure`,type:'departure',typeLabel:'発車',target:new Date(stationMs),status:'active',deltaMs:stationMs-nowMs,approximate:!v.verified,activeUntil:new Date(stationMs+DEPARTURE_WINDOW_MS)};
      }
      return null;
    }

    function getFocuses(now,stationId,filters={}){
      return filterVisits(buildVisits(now,stationId),filters)
        .map(v=>focusForVisit(v,now))
        .filter(Boolean)
        .sort((a,b)=>{
          const rank={active:0,soon:1,future:2};
          if(rank[a.status]!==rank[b.status]) return rank[a.status]-rank[b.status];
          const ad=Math.max(0,a.deltaMs),bd=Math.max(0,b.deltaMs);
          if(ad!==bd) return ad-bd;
          return a.visit.stationAt-b.visit.stationAt;
        });
    }

    function getOvernightState(now,stationId){
      if(stationId!=='TX19'||!TX19_EDGE) return null;
      const dayType=dayTypeForMoment(now);
      const cfg=TX19_EDGE[dayType]?.overnight;
      if(!cfg)return null;
      const [startH,startM]=cfg.startsAfter.split(':').map(Number);
      const [wakeH,wakeM]=cfg.endsBefore.split(':').map(Number);
      const start=new Date(now); start.setHours(startH,startM+1,0,0);
      const wake=new Date(now); wake.setHours(wakeH,wakeM,0,0);
      if(now<start||now>=wake) return null;
      return {
        active:true,label:'終電後',serviceDayType:dayType,message:'電車もひと休み。朝になったらまた見よう。',
        next:cfg.next.map(n=>{
          const [h,m]=n.time.split(':').map(Number),at=new Date(now); at.setHours(h,m,0,0);
          return {...n,at};
        })
      };
    }

    function focusTitle(f){
      if(f.type==='arrival'){
        if(f.status==='active')return'いま、停まるところ！';
        if(f.deltaMs<=30_000)return'もうすぐ到着！';
        return'つぎは到着';
      }
      if(f.type==='departure'){
        if(f.status==='active')return'発車の時間帯！';
        if(f.deltaMs<=30_000)return'もうすぐ発車の時間！';
        return'つぎは発車';
      }
      if(f.status==='active')return'いま、通過！';
      if(f.deltaMs<=30_000)return'もうすぐ通過！';
      return'つぎは通過';
    }
    function focusMessage(f){
      if(f.type==='arrival')return f.status==='active'?'停まる瞬間を見よう':'電車が入ってくるよ';
      if(f.type==='departure')return f.status==='active'?'動く瞬間を見よう':'発車を見逃さないで';
      return f.status==='active'?'ビューン！':'速い電車を見よう';
    }
    function focusCountdown(f,now){
      if(f.status==='active')return'いま！';
      if(f.deltaMs>LONG_WAIT_MS)return f.visit.time;
      return fmtClock(+f.target-+now);
    }

    const engine={
      RAIL_ID:'tx',LINE_ID:'tx',LINE_NAME:'つくばエクスプレス',DEFAULT_STATION:'TX19',SUPPORTS_PASS:true,
      DATA_META:{dataVersion:DATA.dataVersion,checkedAt:DATA.checkedAt,timetableRevision:DATA.timetableRevision,validThrough:DATA.validThrough,source:DATA.source,coverage:DATA.coverage},
      STATIONS,SERVICE,ARRIVAL_LEAD_MS,DEPARTURE_WINDOW_MS,LONG_WAIT_MS,SERVICE_DAY_BOUNDARY_HOUR,
      stationById,dirText,isOrigin,isTerminal,fmtTime,fmtClock,fmtRemain,dateKey,serviceDateForMoment,dayTypeForMoment,
      buildVisits,filterVisits,focusForVisit,getFocuses,getOvernightState,focusTitle,focusMessage,focusCountdown
    };
    window.TrainWatchEngine=engine;
    return engine;
  })();
})();
