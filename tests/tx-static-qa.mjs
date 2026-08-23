import fs from 'node:fs';

for (const file of ['tx-special.js','tx-special.css','data/tx-profile.json','docs/media-credits.md','docs/tx-design.md','playwright.config.js','tests/user-scenarios.spec.js','ux-v6.css']) {
  if (!fs.existsSync(file)) throw new Error(`Missing TX experience asset: ${file}`);
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
for(const required of ["fetch('./data/tx-profile.json'",'findNextPass','findNextRare','denshaKuruyoVehicleCollectionV1','renderedVehicleStationId']){
  if(!js.includes(required)) throw new Error(`TX behavior missing: ${required}`);
}
if(js.includes('if (vehicleDialog?.open) renderVehicleDialog();')) throw new Error('Vehicle dialog must not rebuild every stationCode mutation tick');
if(!js.includes('nextStationId === observedStationId')) throw new Error('Station observer must ignore no-op station code mutations');

const onboarding=fs.readFileSync('onboarding.js','utf8');
if(!onboarding.includes("href='./tx-special.css'")||!onboarding.includes("'./tx-special.js'")) throw new Error('TX assets are not loaded by onboarding layer');
if(!onboarding.includes("href='./ux-v6.css'")||!onboarding.includes("'./ux-v6.js'")) throw new Error('Shared UX v6 layer must load after rail-specific styling');

const css=fs.readFileSync('tx-special.css','utf8');
if(!css.includes('.tx-vehicle-photo')) throw new Error('TX vehicle visualization styles are missing');
const tiny=[...css.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)].map(m=>Number(m[1])).filter(n=>n<13);
if(tiny.length) throw new Error(`tx-special.css contains font sizes below 13px: ${tiny.join(', ')}`);

const uxCss=fs.readFileSync('ux-v6.css','utf8');
if(!uxCss.includes('--brand-blue: #2f5d68')||!uxCss.includes('--brand-coral: #4f7568')) throw new Error('TX effective palette must use calm teal/green tokens');
if(!uxCss.includes('--danger: #b3261e')) throw new Error('Red must be reserved in a danger token');
if(!uxCss.includes('grid-template-rows: auto minmax(0, 1fr)')||!uxCss.includes('position: static !important')) throw new Error('Dialogs must use static header + scrolling body');

const sw=fs.readFileSync('sw.js','utf8');
for(const asset of ['./tx-special.css','./tx-special.js','./data/tx-profile.json','./ux-v6.css','./ux-v6.js']){
  if(!sw.includes(asset)) throw new Error(`Service Worker must cache ${asset}`);
}

const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
if(!manifest.description.includes('TX')||!manifest.description.includes('京成本線')||!manifest.description.includes('非公式')) throw new Error('PWA metadata must describe the current two-rail unofficial product');

const readme=fs.readFileSync('README.md','utf8');
if(!readme.includes('### TXでできること')||!readme.includes('次に通過する「ビューン」')) throw new Error('README must explain the TX-specific experience');
if(!readme.includes('docs/tx-design.md')) throw new Error('README must link to TX design documentation');
if(!readme.includes('たまたま泊まったホテル')||!readme.includes('電車好きの息子')) throw new Error('README product origin must match the real story');

const txDesign=fs.readFileSync('docs/tx-design.md','utf8');
if(!txDesign.includes('安全性・信頼性')||!txDesign.includes('警告・エラー')||!txDesign.includes('公式アプリと誤認させない')) throw new Error('TX design documentation must explain current color intent and unofficial positioning');
if(txDesign.includes('TX専用の非公式ファンツール')) throw new Error('TX design docs must not describe the whole product as TX-only');

const scenarios=fs.readFileSync('tests/user-scenarios.spec.js','utf8');
for(const phrase of ['1画面1メッセージ','見る場所ダイアログ','研究学園では2000系・3000系','横にはみ出さない','写真DOMが毎秒作り直されない']){
  if(!scenarios.includes(phrase)) throw new Error(`Scenario test missing: ${phrase}`);
}
const uxScenarios=fs.readFileSync('tests/ux-v6-scenarios.spec.js','utf8');
if(!uxScenarios.includes('モーダルはヘッダーではなくボディだけがスクロールする')) throw new Error('Dialog-body scrolling scenario is missing');

console.log('TX experience static QA passed');
