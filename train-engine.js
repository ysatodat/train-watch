(() => {
  'use strict';

  const STATIONS = [
    ['TX01','秋葉原','Akihabara'],['TX02','新御徒町','Shin-okachimachi'],['TX03','浅草','Asakusa'],['TX04','南千住','Minami-senju'],['TX05','北千住','Kita-senju'],['TX06','青井','Aoi'],['TX07','六町','Rokucho'],['TX08','八潮','Yashio'],['TX09','三郷中央','Misato-chuo'],['TX10','南流山','Minami-nagareyama'],['TX11','流山セントラルパーク','Nagareyama-centralpark'],['TX12','流山おおたかの森','Nagareyama-otakanomori'],['TX13','柏の葉キャンパス','Kashiwanoha-campus'],['TX14','柏たなか','Kashiwa-tanaka'],['TX15','守谷','Moriya'],['TX16','みらい平','Miraidaira'],['TX17','みどりの','Midorino'],['TX18','万博記念公園','Bampaku-kinenkoen'],['TX19','研究学園','Kenkyu-gakuen'],['TX20','つくば','Tsukuba']
  ].map((x, i) => ({ id:x[0], name:x[1], en:x[2], i }));

  const SERVICE = { local:{ label:'普通' }, section:{ label:'区間快速' }, rapid:{ label:'快速' } };
  const DOWN = {
    local:[0,2,4,7,10,13,15,19,22,25,28,30,33,36,40,45,48,51,54,57],
    section:[0,2,4,7,10,null,null,17,20,23,null,26,30,null,35,40,43,46,49,52],
    rapid:[0,2,4,7,10,null,null,17,null,21,null,25,null,null,32,null,null,null,null,45]
  };
  const UP = {
    local:[66,63,61,58,55,52,50,46,43,40,37,34,31,29,24,13,9,6,3,0],
    section:[54,51,49,46,43,null,null,37,33,30,null,27,23,null,18,13,10,7,3,0],
    rapid:[45,43,41,38,35,null,null,28,null,24,null,20,null,null,13,null,null,null,null,0]
  };

  const ARRIVAL_LEAD_MS=35_000, DEPARTURE_WINDOW_MS=60_000, PASS_ACTIVE_BEFORE_MS=10_000, PASS_ACTIVE_AFTER_MS=10_000;
  function stationById(id){return STATIONS.find(s=>s.id===id)||STATIONS[18]}
  function minutes(h,m){return h*60+m}
  function dirText(v){return v.dir==='down'?'つくば方面':'秋葉原方面'}
  function isOrigin(v){return(v.dir==='down'&&v.stationId==='TX01')||(v.dir==='up'&&v.stationId==='TX20')}
  function isTerminal(v){return(v.dir==='down'&&v.stationId==='TX20')||(v.dir==='up'&&v.stationId==='TX01')}
  function fmtTime(d){return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
  function fmtClock(ms){const s=Math.max(0,Math.ceil(ms/1000));return`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
  function fmtRemain(ms){const s=Math.max(0,Math.ceil(ms/1000));return s<60?`あと${s}秒`:`あと${Math.floor(s/60)}分${String(s%60).padStart(2,'0')}秒`}
  function targetFrom(baseMin,offset,day,extra){const d=new Date(day);d.setHours(0,0,0,0);d.setMinutes(baseMin+offset);return{...extra,stationAt:d,time:fmtTime(d)}}
  function interpolate(arr,index,baseline){if(arr[index]!=null)return{offset:arr[index],approx:false};let l=index-1,r=index+1;while(l>=0&&arr[l]==null)l--;while(r<arr.length&&arr[r]==null)r++;if(l<0||r>=arr.length)return{offset:null,approx:true};const p=(baseline[index]-baseline[l])/(baseline[r]-baseline[l]);return{offset:arr[l]+(arr[r]-arr[l])*p,approx:true}}

  function buildVisits(now,stationId){const station=stationById(stationId),out=[],baseDay=new Date(now);baseDay.setHours(0,0,0,0);for(let h=8;h<=23;h++){const downBases=[['rapid',0],['section',16],['local',27],['rapid',30],['section',46],['local',57]],upBases=[['local',4],['rapid',12],['section',20],['local',34],['rapid',42],['section',50]];downBases.forEach(([kind,m])=>{const inf=interpolate(DOWN[kind],station.i,DOWN.local);if(inf.offset==null)return;out.push(targetFrom(minutes(h,m),inf.offset,baseDay,{kind,dir:'down',stationId,stop:DOWN[kind][station.i]!=null,approx:inf.approx,id:`d-${h}-${m}-${kind}-${stationId}`}))});upBases.forEach(([kind,m])=>{const inf=interpolate(UP[kind],station.i,UP.local);if(inf.offset==null)return;out.push(targetFrom(minutes(h,m),inf.offset,baseDay,{kind,dir:'up',stationId,stop:UP[kind][station.i]!=null,approx:inf.approx,id:`u-${h}-${m}-${kind}-${stationId}`}))})}return out.filter(v=>v.stationAt-now>-90_000).sort((a,b)=>a.stationAt-b.stationAt)}
  function filterVisits(visits,filters={}){const includePass=filters.includePass!==false,dir=filters.dir||'both';return visits.filter(v=>(includePass||v.stop)&&(dir==='both'||v.dir===dir))}

  function focusForVisit(v,now){const nowMs=+now,stationMs=+v.stationAt;if(!v.stop){const delta=stationMs-nowMs;if(delta<-PASS_ACTIVE_AFTER_MS)return null;const active=delta<=PASS_ACTIVE_BEFORE_MS&&delta>=-PASS_ACTIVE_AFTER_MS;return{visit:v,key:`${v.id}:pass`,type:'pass',typeLabel:'通過',target:new Date(stationMs),status:active?'active':delta<=180_000?'soon':'future',deltaMs:delta,approximate:true,activeUntil:new Date(stationMs+PASS_ACTIVE_AFTER_MS)}}
    if(isOrigin(v)){const delta=stationMs-nowMs;if(delta<-DEPARTURE_WINDOW_MS)return null;const active=delta<=0;return{visit:v,key:`${v.id}:departure`,type:'departure',typeLabel:'発車',target:new Date(stationMs),status:active?'active':delta<=180_000?'soon':'future',deltaMs:delta,approximate:true,activeUntil:new Date(stationMs+DEPARTURE_WINDOW_MS)}}
    if(isTerminal(v)){const delta=stationMs-nowMs;if(delta<-30_000)return null;const active=delta<=10_000;return{visit:v,key:`${v.id}:arrival-terminal`,type:'arrival',typeLabel:'到着',target:new Date(stationMs),status:active?'active':delta<=180_000?'soon':'future',deltaMs:delta,approximate:v.approx,activeUntil:new Date(stationMs+30_000)}}
    const arrivalMs=stationMs-ARRIVAL_LEAD_MS;if(nowMs<stationMs){const delta=arrivalMs-nowMs;return{visit:v,key:`${v.id}:arrival`,type:'arrival',typeLabel:'到着',target:new Date(arrivalMs),status:delta<=0?'active':delta<=180_000?'soon':'future',deltaMs:delta,approximate:true,activeUntil:new Date(stationMs)}}
    if(nowMs<stationMs+DEPARTURE_WINDOW_MS)return{visit:v,key:`${v.id}:departure`,type:'departure',typeLabel:'発車',target:new Date(stationMs),status:'active',deltaMs:stationMs-nowMs,approximate:true,activeUntil:new Date(stationMs+DEPARTURE_WINDOW_MS)};return null}

  function getFocuses(now,stationId,filters={}){return filterVisits(buildVisits(now,stationId),filters).map(v=>focusForVisit(v,now)).filter(Boolean).sort((a,b)=>{const rank={active:0,soon:1,future:2};if(rank[a.status]!==rank[b.status])return rank[a.status]-rank[b.status];const ad=Math.max(0,a.deltaMs),bd=Math.max(0,b.deltaMs);if(ad!==bd)return ad-bd;return a.visit.stationAt-b.visit.stationAt})}
  function focusTitle(f){if(f.type==='arrival'){if(f.status==='active')return'いま、停まるところ！';if(f.deltaMs<=30_000)return'もうすぐ到着！';return'つぎは到着'}if(f.type==='departure'){if(f.status==='active')return'発車の時間帯！';if(f.deltaMs<=30_000)return'もうすぐ発車の時間！';return'つぎは発車'}if(f.status==='active')return'いま、通過！';if(f.deltaMs<=30_000)return'もうすぐ通過！';return'つぎは通過'}
  function focusMessage(f){if(f.type==='arrival')return f.status==='active'?'停まる瞬間を見よう':'電車が入ってくるよ';if(f.type==='departure')return f.status==='active'?'動く瞬間を見よう':'発車を見逃さないで';return f.status==='active'?'ビューン！':'速い電車を見よう'}
  function focusCountdown(f,now){return f.status==='active'?'いま！':fmtClock(+f.target-+now)}
  window.TrainWatchEngine={STATIONS,SERVICE,ARRIVAL_LEAD_MS,DEPARTURE_WINDOW_MS,stationById,dirText,isOrigin,isTerminal,fmtTime,fmtClock,fmtRemain,buildVisits,filterVisits,focusForVisit,getFocuses,focusTitle,focusMessage,focusCountdown};
})();