(() => {
  'use strict';

  const STATIONS = [
    ['TX01','秋葉原','Akihabara'],['TX02','新御徒町','Shin-okachimachi'],['TX03','浅草','Asakusa'],
    ['TX04','南千住','Minami-senju'],['TX05','北千住','Kitasenju'],['TX06','青井','Aoi'],
    ['TX07','六町','Rokucho'],['TX08','八潮','Yashio'],['TX09','三郷中央','Misato-chuo'],
    ['TX10','南流山','Minami-nagareyama'],['TX11','流山セントラルパーク','Nagareyama-centralpark'],
    ['TX12','流山おおたかの森','Nagareyama-otakanomori'],['TX13','柏の葉キャンパス','Kashiwanoha-campus'],
    ['TX14','柏たなか','Kashiwa-tanaka'],['TX15','守谷','Moriya'],['TX16','みらい平','Miraidaira'],
    ['TX17','みどりの','Midorino'],['TX18','万博記念公園','Bampaku-kinenkoen'],
    ['TX19','研究学園','Kenkyu-gakuen'],['TX20','つくば','Tsukuba']
  ].map((x,i)=>({id:x[0],name:x[1],en:x[2],i}));

  const SERVICE = {
    local:{label:'普通'},
    section:{label:'区間快速'},
    rapid:{label:'快速'},
    train:{label:'電車'}
  };

  const DOWN = {
    local:   [0,2,4,7,10,13,15,19,22,25,28,30,33,36,40,45,48,51,54,57],
    section: [0,2,4,7,10,null,null,17,20,23,null,26,30,null,35,40,43,46,49,52],
    rapid:   [0,2,4,7,10,null,null,17,null,21,null,25,null,null,32,null,null,null,null,45]
  };
  const UP = {
    local:   [66,63,61,58,55,52,50,46,43,40,37,34,31,29,24,13,9,6,3,0],
    section: [54,51,49,46,43,null,null,37,33,30,null,27,23,null,18,13,10,7,3,0],
    rapid:   [45,43,41,38,35,null,null,28,null,24,null,20,null,null,13,null,null,null,null,0]
  };

  const ARRIVAL_LEAD_MS = 35_000;
  const DEPARTURE_WINDOW_MS = 60_000;
  const PASS_ACTIVE_BEFORE_MS = 10_000;
  const PASS_ACTIVE_AFTER_MS = 10_000;
  const LONG_WAIT_MS = 90 * 60_000;

  // 研究学園駅: 2026-08時点の公開時刻表を再確認した深夜・早朝枠。
  // 日中は引き続きβモデル。深夜の巨大カウントダウンを避けつつ、0時台の実列車を落とさない。
  const TX19_EXACT = {
    up: [
      [0,3,'local'], [5,9,'section'], [5,35,'section'], [5,50,'section'],
      [6,5,'section'], [6,14,'local'], [6,23,'local'], [6,40,'section'], [6,53,'local'],
      [7,10,'section'], [7,23,'local'], [7,40,'section'], [7,53,'local'],
      [23,2,'local'], [23,17,'local'], [23,25,'local'], [23,37,'local'], [23,49,'local']
    ],
    down: [
      [0,6,'local'], [0,18,'local'], [0,41,'local'],
      [5,34,'local'], [5,54,'local'], [6,3,'local'], [6,25,'local'], [6,43,'local'],
      [6,55,'local'], [7,7,'local'], [7,23,'local'], [7,34,'local'], [7,51,'local'],
      [23,6,'local'], [23,21,'local'], [23,36,'local'], [23,51,'local']
    ]
  };

  function stationById(id){ return STATIONS.find(s=>s.id===id)||STATIONS[18]; }
  function minutes(h,m){ return h*60+m; }
  function dirText(v){ return v.dir==='down'?'つくば方面':'秋葉原方面'; }
  function isOrigin(v){ return (v.dir==='down'&&v.stationId==='TX01')||(v.dir==='up'&&v.stationId==='TX20'); }
  function isTerminal(v){ return (v.dir==='down'&&v.stationId==='TX20')||(v.dir==='up'&&v.stationId==='TX01'); }
  function fmtTime(d){ return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
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
    const lastHour=stationId==='TX19'?22:23;
    for(let h=8;h<=lastHour;h++){
      const downBases=[['rapid',0],['section',16],['local',27],['rapid',30],['section',46],['local',57]];
      const upBases=[['local',4],['rapid',12],['section',20],['local',34],['rapid',42],['section',50]];
      downBases.forEach(([kind,m])=>{
        const inf=interpolate(DOWN[kind],station.i,DOWN.local); if(inf.offset==null)return;
        out.push(targetFrom(minutes(h,m),inf.offset,baseDay,{
          kind,dir:'down',stationId,stop:DOWN[kind][station.i]!=null,approx:inf.approx,
          verified:false,id:`model-d-${h}-${m}-${kind}-${stationId}`
        }));
      });
      upBases.forEach(([kind,m])=>{
        const inf=interpolate(UP[kind],station.i,UP.local); if(inf.offset==null)return;
        out.push(targetFrom(minutes(h,m),inf.offset,baseDay,{
          kind,dir:'up',stationId,stop:UP[kind][station.i]!=null,approx:inf.approx,
          verified:false,id:`model-u-${h}-${m}-${kind}-${stationId}`
        }));
      });
    }
    return out;
  }

  function exactVisitsForDate(day){
    const out=[];
    ['up','down'].forEach(dir=>{
      TX19_EXACT[dir].forEach(([h,m,kind])=>{
        const d=new Date(day); d.setHours(h,m,0,0);
        out.push({
          id:`verified-${dir}-${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}-${h}-${m}`,
          kind,dir,stationId:'TX19',stop:true,approx:false,verified:true,stationAt:d,time:fmtTime(d)
        });
      });
    });
    return out;
  }

  function buildExactTX19(now){
    const today=new Date(now); today.setHours(0,0,0,0);
    const tomorrow=new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    return [...exactVisitsForDate(today),...exactVisitsForDate(tomorrow)];
  }

  function buildVisits(now,stationId){
    const out=buildPatternVisits(now,stationId);
    if(stationId==='TX19') out.push(...buildExactTX19(now));
    const seen=new Set();
    return out
      .filter(v=>v.stationAt-now>-90_000)
      .sort((a,b)=>a.stationAt-b.stationAt)
      .filter(v=>{const k=`${v.id}`; if(seen.has(k))return false; seen.add(k); return true;});
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
      return {
        visit:v,key:`${v.id}:pass`,type:'pass',typeLabel:'通過',target:new Date(stationMs),
        status:active?'active':delta<=180_000?'soon':'future',deltaMs:delta,
        approximate:true,activeUntil:new Date(stationMs+PASS_ACTIVE_AFTER_MS)
      };
    }
    if(isOrigin(v)){
      const delta=stationMs-nowMs;
      if(delta<-DEPARTURE_WINDOW_MS)return null;
      return {
        visit:v,key:`${v.id}:departure`,type:'departure',typeLabel:'発車',target:new Date(stationMs),
        status:delta<=0?'active':delta<=180_000?'soon':'future',deltaMs:delta,
        approximate:!v.verified,activeUntil:new Date(stationMs+DEPARTURE_WINDOW_MS)
      };
    }
    if(isTerminal(v)){
      const delta=stationMs-nowMs;
      if(delta<-30_000)return null;
      return {
        visit:v,key:`${v.id}:arrival-terminal`,type:'arrival',typeLabel:'到着',target:new Date(stationMs),
        status:delta<=10_000?'active':delta<=180_000?'soon':'future',deltaMs:delta,
        approximate:!v.verified||v.approx,activeUntil:new Date(stationMs+30_000)
      };
    }
    const arrivalMs=stationMs-ARRIVAL_LEAD_MS;
    if(nowMs<stationMs){
      const delta=arrivalMs-nowMs;
      return {
        visit:v,key:`${v.id}:arrival`,type:'arrival',typeLabel:'到着',target:new Date(arrivalMs),
        status:delta<=0?'active':delta<=180_000?'soon':'future',deltaMs:delta,
        approximate:true,activeUntil:new Date(stationMs)
      };
    }
    if(nowMs<stationMs+DEPARTURE_WINDOW_MS){
      return {
        visit:v,key:`${v.id}:departure`,type:'departure',typeLabel:'発車',target:new Date(stationMs),
        status:'active',deltaMs:stationMs-nowMs,approximate:!v.verified,
        activeUntil:new Date(stationMs+DEPARTURE_WINDOW_MS)
      };
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
    if(stationId!=='TX19') return null;
    const start=new Date(now); start.setHours(0,42,0,0);
    const wake=new Date(now); wake.setHours(4,50,0,0);
    if(now<start||now>=wake) return null;
    const up=new Date(now); up.setHours(5,9,0,0);
    const down=new Date(now); down.setHours(5,34,0,0);
    return {
      active:true,
      label:'終電後',
      message:'電車もひと休み。朝になったらまた見よう。',
      next:[
        {dir:'up',time:'05:09',at:up,label:'秋葉原方面'},
        {dir:'down',time:'05:34',at:down,label:'つくば方面'}
      ]
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

  window.TrainWatchEngine={
    STATIONS,SERVICE,ARRIVAL_LEAD_MS,DEPARTURE_WINDOW_MS,LONG_WAIT_MS,
    stationById,dirText,isOrigin,isTerminal,fmtTime,fmtClock,fmtRemain,
    buildVisits,filterVisits,focusForVisit,getFocuses,getOvernightState,
    focusTitle,focusMessage,focusCountdown
  };
})();