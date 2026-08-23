(() => {
  'use strict';
  if(window.RailContext?.rail!=='keisei')return;
  window.TrainWatchEngineReady=(async()=>{
    const response=await fetch('./data/keisei-main.json',{cache:'no-cache'});
    if(!response.ok)throw new Error(`Keisei timetable load failed: ${response.status}`);
    const DATA=await response.json();
    const STATIONS=DATA.stations.map((s,i)=>({...s,i}));
    const SERVICE=Object.fromEntries(Object.entries(DATA.services||{}).map(([key,label])=>[key,{label}]));
    const HOLIDAYS=new Set(['2026-01-01','2026-01-12','2026-02-11','2026-02-23','2026-03-20','2026-04-29','2026-05-03','2026-05-04','2026-05-05','2026-05-06','2026-07-20','2026-08-11','2026-09-21','2026-09-22','2026-09-23','2026-10-12','2026-11-03','2026-11-23']);
    const ARRIVAL_LEAD_MS=35_000,DEPARTURE_WINDOW_MS=60_000,LONG_WAIT_MS=90*60_000,SERVICE_DAY_BOUNDARY_HOUR=4;
    const stationById=id=>STATIONS.find(s=>s.id===id)||STATIONS.find(s=>s.id==='KS22')||STATIONS[0];
    const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const serviceDateForMoment=moment=>{const d=new Date(moment);if(d.getHours()<SERVICE_DAY_BOUNDARY_HOUR)d.setDate(d.getDate()-1);d.setHours(12,0,0,0);return d;};
    const dayTypeForMoment=moment=>{const d=serviceDateForMoment(moment);return[0,6].includes(d.getDay())||HOLIDAYS.has(dateKey(d))?'holiday':'weekday';};
    const fmtTime=d=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const fmtClock=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
    const fmtRemain=ms=>{const s=Math.max(0,Math.ceil(ms/1000));if(s<60)return`あと${s}秒`;if(s<3600)return`あと${Math.floor(s/60)}分${String(s%60).padStart(2,'0')}秒`;const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);if(h<3)return`あと${h}時間${m?`${m}分`:''}`;return`約${Math.round(s/3600)}時間後`;};
    const dirText=v=>(DATA.directions?.[v.dir]|| (v.dir==='up'?'上野・押上方面':'成田・空港方面'));
    const isOrigin=v=>!!v.origin;
    const isTerminal=()=>false;

    function serviceDayAt(day,h,m){const d=new Date(day);d.setHours(0,0,0,0);if(h<SERVICE_DAY_BOUNDARY_HOUR)d.setDate(d.getDate()+1);d.setHours(h,m,0,0);return d;}
    function visitsForServiceDay(day,stationId){
      const noon=new Date(day);noon.setHours(12,0,0,0);const type=dayTypeForMoment(noon);const list=DATA.timetable?.[type]?.[stationId]||[];return list.map((e,index)=>{
        const [h,m]=e.time.split(':').map(Number),at=serviceDayAt(day,h,m);
        const endpointOrigin=(stationId==='KS01'&&e.dir==='down')||(stationId==='KS42'&&e.dir==='up');
        return{id:`keisei-${dateKey(noon)}-${stationId}-${e.dir}-${e.time}-${e.service}-${index}`,kind:e.service||'other',dir:e.dir,stationId,stop:true,approx:false,verified:true,origin:endpointOrigin,destination:e.destination,stationAt:at,time:fmtTime(at)};
      });
    }
    function buildVisits(now,stationId){
      const service=serviceDateForMoment(now);service.setHours(0,0,0,0);const prev=new Date(service);prev.setDate(prev.getDate()-1);const next=new Date(service);next.setDate(next.getDate()+1);
      return[...visitsForServiceDay(prev,stationId),...visitsForServiceDay(service,stationId),...visitsForServiceDay(next,stationId)].filter(v=>v.stationAt-now>-90_000).sort((a,b)=>a.stationAt-b.stationAt);
    }
    function filterVisits(visits,filters={}){const dir=filters.dir||'both';return visits.filter(v=>dir==='both'||v.dir===dir);}
    function focusForVisit(v,now){
      const nowMs=+now,stationMs=+v.stationAt;
      if(isOrigin(v)){const delta=stationMs-nowMs;if(delta<-DEPARTURE_WINDOW_MS)return null;return{visit:v,key:`${v.id}:departure`,type:'departure',typeLabel:'発車',target:new Date(stationMs),status:delta<=0?'active':delta<=180_000?'soon':'future',deltaMs:delta,approximate:false,activeUntil:new Date(stationMs+DEPARTURE_WINDOW_MS)};}
      const arrivalMs=stationMs-ARRIVAL_LEAD_MS;
      if(nowMs<stationMs){const delta=arrivalMs-nowMs;return{visit:v,key:`${v.id}:arrival`,type:'arrival',typeLabel:'到着',target:new Date(arrivalMs),status:delta<=0?'active':delta<=180_000?'soon':'future',deltaMs:delta,approximate:true,activeUntil:new Date(stationMs)};}
      if(nowMs<stationMs+DEPARTURE_WINDOW_MS)return{visit:v,key:`${v.id}:departure`,type:'departure',typeLabel:'発車',target:new Date(stationMs),status:'active',deltaMs:stationMs-nowMs,approximate:false,activeUntil:new Date(stationMs+DEPARTURE_WINDOW_MS)};
      return null;
    }
    function getFocuses(now,stationId,filters={}){return filterVisits(buildVisits(now,stationId),filters).map(v=>focusForVisit(v,now)).filter(Boolean).sort((a,b)=>{const rank={active:0,soon:1,future:2};if(rank[a.status]!==rank[b.status])return rank[a.status]-rank[b.status];return Math.max(0,a.deltaMs)-Math.max(0,b.deltaMs)||a.visit.stationAt-b.visit.stationAt;});}
    function getOvernightState(){return null;}
    function focusTitle(f){if(f.type==='arrival'){if(f.status==='active')return'いま、停まるところ！';if(f.deltaMs<=30_000)return'もうすぐ到着！';return'つぎは到着';}if(f.status==='active')return'発車の時間帯！';if(f.deltaMs<=30_000)return'もうすぐ発車の時間！';return'つぎは発車';}
    function focusMessage(f){return f.type==='arrival'?(f.status==='active'?'停まる瞬間を見よう':'電車が入ってくるよ'):(f.status==='active'?'動く瞬間を見よう':'発車を見逃さないで');}
    function focusCountdown(f,now){if(f.status==='active')return'いま！';if(f.deltaMs>LONG_WAIT_MS)return f.visit.time;return fmtClock(+f.target-+now);}
    const engine={RAIL_ID:'keisei',LINE_ID:'main',LINE_NAME:'京成本線',DEFAULT_STATION:'KS22',SUPPORTS_PASS:false,DATA_META:{dataVersion:DATA.dataVersion,checkedAt:DATA.checkedAt,timetableRevision:DATA.timetableRevision,validThrough:DATA.validThrough,source:DATA.source,coverage:DATA.coverage},STATIONS,SERVICE,ARRIVAL_LEAD_MS,DEPARTURE_WINDOW_MS,LONG_WAIT_MS,SERVICE_DAY_BOUNDARY_HOUR,stationById,dirText,isOrigin,isTerminal,fmtTime,fmtClock,fmtRemain,dateKey,serviceDateForMoment,dayTypeForMoment,buildVisits,filterVisits,focusForVisit,getFocuses,getOvernightState,focusTitle,focusMessage,focusCountdown};
    window.TrainWatchEngine=engine;return engine;
  })();
})();
