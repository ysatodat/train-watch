import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync('train-engine.js','utf8');
const sandbox={window:{},Date,console};
vm.createContext(sandbox);
vm.runInContext(code,sandbox);
const E=sandbox.window.TrainWatchEngine;
if (!E) throw new Error('TrainWatchEngine did not initialize');
if (E.STATIONS.length!==20) throw new Error('TX station count must be 20');

const base=new Date('2026-08-23T12:00:00+09:00');
const visits=E.buildVisits(base,'TX19');
const stop=visits.find(v=>v.stop && !E.isOrigin(v));
const pass=visits.find(v=>!v.stop);
if (!stop || !pass) throw new Error('Need both stopping and passing visits at TX19');

const arrivalBefore=new Date(+stop.stationAt-E.ARRIVAL_LEAD_MS-20000);
const arrivalActive=new Date(+stop.stationAt-E.ARRIVAL_LEAD_MS+5000);
const departureActive=new Date(+stop.stationAt+20000);
const f1=E.focusForVisit(stop,arrivalBefore);
const f2=E.focusForVisit(stop,arrivalActive);
const f3=E.focusForVisit(stop,departureActive);
if (f1?.type!=='arrival') throw new Error('Stopping train must first expose arrival');
if (f2?.type!=='arrival' || f2.status!=='active') throw new Error('Arrival must become active');
if (f3?.type!=='departure' || f3.status!=='active') throw new Error('Stopping train must transition to departure window');

const passActive=E.focusForVisit(pass,new Date(+pass.stationAt));
if (passActive?.type!=='pass' || passActive.status!=='active') throw new Error('Passing train must have active pass moment');

const terminalVisit=E.buildVisits(base,'TX20').find(v=>v.dir==='down'&&v.stop);
if (!terminalVisit || !E.isTerminal(terminalVisit)) throw new Error('TX20 down train must be terminal arrival');
const terminalAfter=E.focusForVisit(terminalVisit,new Date(+terminalVisit.stationAt+20000));
if (terminalAfter?.type!=='arrival') throw new Error('Terminal arrival must not transition to departure');

console.log('Moment engine QA passed');