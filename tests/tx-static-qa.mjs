import fs from 'node:fs';

for (const file of ['tx-special.js','tx-special.css','data/tx-profile.json','docs/media-credits.md','docs/tx-design.md','playwright.config.js','tests/user-scenarios.spec.js']) {
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
for(const required of ["fetch('./data/tx-profile.json'",'findNextPass','findNextRare','denshaKuruyoVehicleCollectionV1','TX専用・非公式','renderedVehicleStationId']){
  if(!js.includes(required)) throw new Error(`TX behavior missing: ${required}`);
}
if(js.includes('if (vehicleDialog?.open) renderVehicleDialog();')) throw new Error('Vehicle dialog must not rebuild every stationCode mutation tick');
if(!js.includes('nextStationId === observedStationId')) throw new Error('Station observer must ignore no-op station code mutations');

const onboarding=fs.readFileSync('onboarding.js','utf8');
if(!onboarding.includes("href='./tx-special.css'")||!onboarding.includes("'./tx-special.js'")) throw new Error('TX-specialized assets are not loaded by onboarding layer');

const css=fs.readFileSync('tx-special.css','utf8');
if(!css.includes('.tx-vehicle-photo')) throw new Error('TX vehicle visualization styles are missing');
if(!css.includes('--tx-blue: #003b8f')||!css.includes('--tx-red: #e40046')) throw new Error('TX-inspired blue/red design tokens are missing');
const tiny=[...css.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)].map(m=>Number(m[1])).filter(n=>n<13);
if(tiny.length) throw new Error(`tx-special.css contains font sizes below 13px: ${tiny.join(', ')}`);

const nativeCss=fs.readFileSync('native-ui.css','utf8');
if(!/\.dialog-header\s*\{[\s\S]*?position:\s*sticky/.test(nativeCss)||!nativeCss.includes('z-index: 20')) throw new Error('Dialog header must stay visible while scrolling');

const sw=fs.readFileSync('sw.js','utf8');
for(const asset of ['./tx-special.css','./tx-special.js','./data/tx-profile.json']){
  if(!sw.includes(asset)) throw new Error(`Service Worker must cache ${asset}`);
}

const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
if(!manifest.description.includes('TX')||!manifest.description.includes('京成本線')||!manifest.description.includes('非公式')) throw new Error('PWA metadata must describe the current two-rail unofficial product');

const readme=fs.readFileSync('README.md','utf8');
if(!readme.includes('### TXでできること')||!readme.includes('次に通過する「ビューン」')) throw new Error('README must explain the TX-specialized experience');
if(!readme.includes('docs/tx-design.md')) throw new Error('README must link to TX design documentation');
if(!readme.includes('たまたま泊まったホテル')||!readme.includes('電車好きの息子')) throw new Error('README product origin must match the real story');

const txDesign=fs.readFileSync('docs/tx-design.md','utf8');
if(!txDesign.includes('安全性・信頼性')||!txDesign.includes('活気・エネルギー')||!txDesign.includes('公式アプリと誤認させない')) throw new Error('TX design documentation must explain color intent and unofficial positioning');

const scenarios=fs.readFileSync('tests/user-scenarios.spec.js','utf8');
for(const phrase of ['1画面1メッセージ','見る場所ダイアログ','研究学園では2000系・3000系','横にはみ出さない','写真DOMが毎秒作り直されない','閉じるボタンが表示領域に残る']){
  if(!scenarios.includes(phrase)) throw new Error(`Scenario test missing: ${phrase}`);
}

console.log('TX-specialized static QA passed');
