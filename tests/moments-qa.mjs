import fs from 'node:fs';
import vm from 'node:vm';

process.env.TZ='Asia/Tokyo';
const code=fs.readFileSync('train-engine.js','utf8');
const data=JSON.parse(fs.readFileSync('data/timetable.json','utf8'));
const copy=()=>JSON.parse(JSON.stringify(data));
const sandbox={
  window:{},Date,console,
  fetch:async()=>({ok:true,status:200,json:async()=>copy()})
};
vm.createContext(sandbox);
vm.runInContext(code,sandbox);
const E=await sandbox.window.TrainWatchEngineReady;
if(!E) throw new Error('TrainWatchEngine did not initialize');
if(E.STATIONS.length!==20) throw new Error('TX station count must be 20');
if(E.DATA_META.dataVersion!==data.dataVersion) throw new Error('Engine data version must match timetable JSON');

const base=new Date(2026,7,23,12,0,0);
const visits=E.buildVisits(base,'TX19');
const stop=visits.find(v=>v.stop&&!E.isOrigin(v)&&!E.isTerminal(v));
const pass=visits.find(v=>!v.stop);
if(!stop||!pass) throw new Error('Need stopping and passing visits at TX19');

// User input is optional: schedule-only flow must complete by itself.
const before=new Date(+stop.stationAt-E.ARRIVAL_LEAD_MS-20_000);
const arriving=new Date(+stop.stationAt-E.ARRIVAL_LEAD_MS+5_000);
const departing=new Date(+stop.stationAt+20_000);
const finished=new Date(+stop.stationAt+E.DEPARTURE_WINDOW_MS+1_000);
const f1=E.focusForVisit(stop,before);
const f2=E.focusForVisit(stop,arriving);
const f3=E.focusForVisit(stop,departing);
const f4=E.focusForVisit(stop,finished);
if(f1?.type!=='arrival') throw new Error('No-input flow must start with arrival');
if(f2?.type!=='arrival'||f2.status!=='active') throw new Error('No-input arrival must activate');
if(f3?.type!=='departure'||f3.status!=='active') throw new Error('No-input flow must auto transition to departure');
if(f4!==null) throw new Error('No-input flow must auto finish after departure window');

const passActive=E.focusForVisit(pass,new Date(+pass.stationAt));
if(passActive?.type!=='pass'||passActive.status!=='active') throw new Error('Passing train must activate');

const midnight=new Date(2026,7,23,0,28,0);
const midnightVisits=E.buildVisits(midnight,'TX19');
const next=midnightVisits.find(v=>+v.stationAt>+midnight);
if(!next||next.time!=='00:41'||next.dir!=='down'||!next.verified){
  throw new Error(`Expected verified TX19 00:41 next train, got ${next?.time} ${next?.dir}`);
}

const afterLast=new Date(2026,7,23,1,0,0);
const overnight=E.getOvernightState(afterLast,'TX19');
if(!overnight?.active||overnight.next[0].time!=='05:09'||overnight.next[1].time!=='05:34'){
  throw new Error('Overnight state must expose first trains');
}
if(E.fmtRemain(5*60*60*1000).includes('300分')) throw new Error('Long waits must not use huge minute counts');

const terminalVisit=E.buildVisits(base,'TX20').find(v=>v.dir==='down'&&v.stop);
if(!terminalVisit||!E.isTerminal(terminalVisit)) throw new Error('TX20 down train must be terminal arrival');
const terminalAfter=E.focusForVisit(terminalVisit,new Date(+terminalVisit.stationAt+20_000));
if(terminalAfter?.type!=='arrival') throw new Error('Terminal arrival must not transition to departure');

console.log('Moment engine QA passed');
