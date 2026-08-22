import fs from 'node:fs';

for (const file of ['app.js','observation-v2.css','sw.js','tests/user-scenarios.spec.js']) {
  if (!fs.existsSync(file)) throw new Error(`Missing observation resilience asset: ${file}`);
}

const app = fs.readFileSync('app.js','utf8');
for (const phrase of [
  'OBSERVED_HOLD_MS=10*60_000',
  'isUnconfirmedDeparture',
  "feedbackAction:'departed'",
  "action==='waiting'",
  "#heroMomentAction,#heroDelayAction",
  "return !(o.departedAt||o.seenAt)"
]) {
  if (!app.includes(phrase)) throw new Error(`Observation behavior missing: ${phrase}`);
}
if (!app.includes("link.href='./observation-v2.css'")) throw new Error('Observation resilience stylesheet must be loaded');

const css = fs.readFileSync('observation-v2.css','utf8');
if (!css.includes('.hero-delay-action') || !css.includes('.observation-complete') || !css.includes('.waiting-observed')) {
  throw new Error('Observation feedback styles are incomplete');
}
const tiny=[...css.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)].map(m=>Number(m[1])).filter(n=>n<13);
if(tiny.length) throw new Error(`observation-v2.css contains font sizes below 13px: ${tiny.join(', ')}`);

const sw=fs.readFileSync('sw.js','utf8');
if(!sw.includes("'./observation-v2.css'")) throw new Error('Service Worker must cache observation-v2.css');

const scenarios=fs.readFileSync('tests/user-scenarios.spec.js','utf8');
for(const phrase of ['停まった→動いたを押すと同じ列車の停まったへ戻らず','まだ来てないでその列車を待ち続けられる']){
  if(!scenarios.includes(phrase)) throw new Error(`User scenario missing: ${phrase}`);
}

console.log('Observation resilience static QA passed');
