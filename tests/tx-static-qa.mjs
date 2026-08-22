import fs from 'node:fs';

for (const file of ['tx-special.js','tx-special.css','data/tx-profile.json','docs/media-credits.md','playwright.config.js','tests/user-scenarios.spec.js']) {
  if (!fs.existsSync(file)) throw new Error(`Missing TX-specialized asset: ${file}`);
}

const profile=JSON.parse(fs.readFileSync('data/tx-profile.json','utf8'));
if(profile.line?.stationCount!==20||profile.line?.lengthKm!==58.3||profile.line?.maxSpeedKmh!==130){
  throw new Error('TX line profile facts are incomplete');
}
if(!Array.isArray(profile.vehicles)||profile.vehicles.length!==3) throw new Error('TX vehicle profile must contain three vehicle classes');
const byId=Object.fromEntries(profile.vehicles.map(v=>[v.id,v]));
if(byId['TX-1000']?.serviceRange?.to!=='TX15') throw new Error('TX-1000 must end at Moriya TX15');
if(byId['TX-2000']?.serviceRange?.to!=='TX20'||byId['TX-3000']?.serviceRange?.to!=='TX20') throw new Error('TX-2000 and TX-3000 must cover the full line');
for(const vehicle of profile.vehicles){
  if(!vehicle.image?.page||!vehicle.image?.author||!vehicle.image?.license||!vehicle.image?.licenseUrl) throw new Error(`${vehicle.id} media attribution is incomplete`);
  if(!vehicle.image.page.includes('commons.wikimedia.org')) throw new Error(`${vehicle.id} must link to its Commons source page`);
}

const js=fs.readFileSync('tx-special.js','utf8');
for(const required of ["fetch('./data/tx-profile.json'",'findNextPass','findNextRare','denshaKuruyoVehicleCollectionV1','tx-route-intro']){
  if(!js.includes(required)) throw new Error(`TX behavior missing: ${required}`);
}

const onboarding=fs.readFileSync('onboarding.js','utf8');
if(!onboarding.includes("href='./tx-special.css'")||!onboarding.includes("script.src='./tx-special.js'")) throw new Error('TX-specialized assets are not loaded by onboarding layer');

const css=fs.readFileSync('tx-special.css','utf8');
if(!css.includes('#stationDialog .station-row::before')||!css.includes('.tx-vehicle-photo')) throw new Error('TX route and vehicle visualization styles are missing');
const tiny=[...css.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)].map(m=>Number(m[1])).filter(n=>n<13);
if(tiny.length) throw new Error(`tx-special.css contains font sizes below 13px: ${tiny.join(', ')}`);

const sw=fs.readFileSync('sw.js','utf8');
for(const asset of ['./tx-special.css','./tx-special.js','./data/tx-profile.json']){
  if(!sw.includes(asset)) throw new Error(`Service Worker must cache ${asset}`);
}

const readme=fs.readFileSync('README.md','utf8');
if(!readme.includes('いまは、あえてTXだけ')||!readme.includes('次に通過する「ビューン」')) throw new Error('README must explain the TX-specialized experience');
if(!readme.includes('たまたま泊まったホテル')||!readme.includes('電車好きの息子')) throw new Error('README product origin must match the real story');

const scenarios=fs.readFileSync('tests/user-scenarios.spec.js','utf8');
for(const phrase of ['3画面チュートリアル','TX路線図','研究学園では2000系・3000系','横にはみ出さない']){
  if(!scenarios.includes(phrase)) throw new Error(`Scenario test missing: ${phrase}`);
}

console.log('TX-specialized static QA passed');
