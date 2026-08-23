import fs from 'node:fs';

for (const file of ['rail-switch.js','rail-switch.css','keisei-engine.js','data/keisei-main-stations.json','data/keisei-main.json','docs/data-sources.md']) {
  if (!fs.existsSync(file)) throw new Error(`Missing two-rail asset: ${file}`);
}

const stationCatalog=JSON.parse(fs.readFileSync('data/keisei-main-stations.json','utf8'));
if(stationCatalog.lineName!=='京成本線'||stationCatalog.stations?.length!==42) throw new Error('Keisei Main Line station catalog must contain 42 stations');
if(stationCatalog.stations[0]?.[0]!=='KS01'||stationCatalog.stations.at(-1)?.[0]!=='KS42') throw new Error('Keisei station range must be KS01 to KS42');
if(fs.statSync('data/keisei-main.json').size<1000) throw new Error('Keisei timetable snapshot is unexpectedly small');

const controller=fs.readFileSync('dialog-controller.js','utf8');
for(const phrase of ['denshaKuruyoLocationReadyV1','needsLocationSetup','goToLocation','lastStations','keisei']){
  if(!controller.includes(phrase)) throw new Error(`Rail context missing: ${phrase}`);
}

const railJs=fs.readFileSync('rail-switch.js','utf8');
for(const phrase of ['location-context-button','location-picker','recent-location-list','data-location-rail','location-station-choice','京成本線']){
  if(!railJs.includes(phrase)) throw new Error(`Location-first UI missing: ${phrase}`);
}
if(/nav\.className\s*=\s*['"]rail-switch['"]/.test(railJs)) throw new Error('Persistent TX/Keisei switch must not be rendered on the first view');
if(!railJs.includes("favorite.hidden=true")||!railJs.includes("favorites-section") ) throw new Error('Low-frequency station-management UI must be removed from the first view');

const railCss=fs.readFileSync('rail-switch.css','utf8');
for(const selector of ['.location-context','.location-context-button','.location-rail-tabs','.location-station-choice']){
  if(!railCss.includes(selector)) throw new Error(`Location CSS missing: ${selector}`);
}
const tiny=[...railCss.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)].map(m=>Number(m[1])).filter(n=>n<13);
if(tiny.length) throw new Error(`rail-switch.css contains font sizes below 13px: ${tiny.join(', ')}`);

const keiseiEngine=fs.readFileSync('keisei-engine.js','utf8');
if(!keiseiEngine.includes("RAIL_ID:'keisei'")||!keiseiEngine.includes("SUPPORTS_PASS:false")||!keiseiEngine.includes("fetch('./data/keisei-main.json'")) throw new Error('Keisei engine must use its official timetable snapshot without inferred pass events');

const onboarding=fs.readFileSync('onboarding.js','utf8');
if(!onboarding.includes('needsLocationSetup')||!onboarding.includes('次の見どころがわかる')||!onboarding.includes('見逃しそうならお知らせ')) throw new Error('Onboarding must follow location setup and explain product value');

const scenarios=fs.readFileSync('tests/user-scenarios.spec.js','utf8');
for(const phrase of ['まず見る場所を選び','路線切替やお気に入り駅UIを常駐させない','TXと京成を切り替え','前回位置へ戻れる']){
  if(!scenarios.includes(phrase)) throw new Error(`Location scenario missing: ${phrase}`);
}

const readme=fs.readFileSync('README.md','utf8');
if(!readme.includes('TXと京成本線')||!readme.includes('最初に、見る場所をえらぶ')||!readme.includes('普段の画面では路線選択や駅一覧を出しっぱなしにしません')) throw new Error('README must describe the two-rail location-first experience');

console.log('Two-rail location-first static QA passed');
