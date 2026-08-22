import fs from 'node:fs';

const requiredFiles = [
  'index.html','train-engine.js','app.js','dialog-controller.js','microinteractions.js','moments-interactions.js','onboarding.js',
  'styles.css','mobile-fixes.css','native-ui.css','brand-refresh.css','moments.css','overnight.css','product-v4.css',
  'data/timetable.json','docs/data-sources.md','README.md','manifest.webmanifest','icon.svg','sw.js'
];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${file}`);
}
JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
const timetable=JSON.parse(fs.readFileSync('data/timetable.json','utf8'));
if (!timetable.dataVersion || !timetable.checkedAt || !timetable.timetableRevision) throw new Error('Timetable provenance metadata is incomplete');
if (timetable.source?.odpt?.requiresApiKey !== true) throw new Error('ODPT API-key requirement must be documented in timetable data');
const tx19down=timetable.verifiedEdgeTimes?.TX19?.down||[];
if (!tx19down.some(x=>x[0]===0&&x[1]===41)) throw new Error('Verified TX19 00:41 service is missing from timetable JSON');

const html=fs.readFileSync('index.html','utf8');
const requiredIds=[
  'stationButton','favoriteToggle','notifyButton','shareButton','openStations','openSettings','openDataInfo','openAbout',
  'stationDialog','settingsDialog','dataDialog','aboutDialog','countdown','timeline','favoriteCards','momentList','rareBanner','watchedCount',
  'heroMomentAction','aboutDataFreshness','dataVersionCopy'
];
for (const id of requiredIds) if (!html.includes(`id="${id}"`)) throw new Error(`Missing required UI id: ${id}`);
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
const duplicates=ids.filter((id,i)=>ids.indexOf(id)!==i);
if (duplicates.length) throw new Error(`Duplicate IDs: ${[...new Set(duplicates)].join(', ')}`);
if (/class="hero-card"[^>]*aria-live=/i.test(html)) throw new Error('Hero countdown must not be aria-live');
if (!/id="notifyButton"[^>]*aria-pressed=/i.test(html)) throw new Error('Notify toggle must expose aria-pressed');
if (!html.includes('./train-engine.js') || !html.includes('./moments.css') || !html.includes('./product-v4.css') || !html.includes('./onboarding.js')) throw new Error('Current product assets are not loaded');
if (html.indexOf('./product-v4.css') < html.indexOf('./moments.css')) throw new Error('Product v4 stylesheet must load after moment styles');
if (/acl:consumerKey\s*=|ODPT_API_KEY\s*=/.test(html)) throw new Error('Do not expose an ODPT API key in public HTML');

for (const file of ['styles.css','brand-refresh.css','mobile-fixes.css','native-ui.css','moments.css','overnight.css','product-v4.css']) {
  const css=fs.readFileSync(file,'utf8');
  const tiny=[...css.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)].map(m=>Number(m[1])).filter(size=>size<13);
  if (tiny.length) throw new Error(`${file} contains font sizes below 13px: ${tiny.join(', ')}`);
}
const brandCss=fs.readFileSync('brand-refresh.css','utf8');
if (!brandCss.includes('--tap-min: 44px')) throw new Error('44px touch-target token is missing');
if (!brandCss.includes('prefers-reduced-motion')) throw new Error('Reduced-motion support is missing');
if (!brandCss.includes('prefers-contrast: more')) throw new Error('Increased-contrast support is missing');

const productCss=fs.readFileSync('product-v4.css','utf8');
if (!/\.moment-card\s*\{[\s\S]*?border-left:\s*0\s*!important/.test(productCss)) throw new Error('Moment rows must remove generic left highlight stripes');
if (!/\.event-row\.next\s*\{[\s\S]*?border-left:\s*0\s*!important/.test(productCss)) throw new Error('Upcoming next row must not use a left highlight stripe');
if (!/\.favorite-card\.active\s*\{[\s\S]*?box-shadow:\s*none\s*!important/.test(productCss)) throw new Error('Favorite selected state must not use an inset accent stripe');
if (!productCss.includes('.hero-moment-action')) throw new Error('First-view observation action styles are missing');

const mobileCss=fs.readFileSync('mobile-fixes.css','utf8');
if (!mobileCss.includes('@media (max-width: 430px)') || !mobileCss.includes('.event-remain')) throw new Error('Common iPhone widths need the two-row timeline fallback');
const momentsCss=fs.readFileSync('moments.css','utf8');
if (!momentsCss.startsWith('@import url("./overnight.css")')) throw new Error('Overnight styles must be loaded by the moment stylesheet');

const appJs=fs.readFileSync('app.js','utf8');
if (appJs.includes("setAttribute('open'")) throw new Error('app.js must not manage dialog open state');
if (appJs.includes('Notification.requestPermission')) throw new Error('Do not request system notification permission for page-only alerts');
if (!appJs.includes("action==='arrived'") || !appJs.includes("action==='departed'") || !appJs.includes("action==='seen'")) throw new Error('Observation actions for arrival/departure/pass are missing');
if (!appJs.includes('heroMomentAction') || !appJs.includes(".moment-action,#heroMomentAction")) throw new Error('Primary observation action must be available in the first view');
if (!appJs.includes('getOvernightState')) throw new Error('Overnight service state is missing');

const engineJs=fs.readFileSync('train-engine.js','utf8');
if (!engineJs.includes("fetch('./data/timetable.json'")) throw new Error('Engine must load versioned timetable JSON');
if (!engineJs.includes('LONG_WAIT_MS')) throw new Error('Long-wait formatting guard is missing');
if (/acl:consumerKey\s*=|ODPT_API_KEY\s*=/.test(engineJs+appJs)) throw new Error('Public client code must not contain an ODPT API key');

const readme=fs.readFileSync('README.md','utf8');
if (!readme.includes('どんなアプリ？') || !readme.includes('使い方は3つだけ') || !readme.includes('安全について')) throw new Error('README must function as a user-facing landing page');

console.log('Static product QA passed');
