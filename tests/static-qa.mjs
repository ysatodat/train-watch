import fs from 'node:fs';

const requiredFiles = [
  'index.html', 'train-engine.js', 'app.js', 'dialog-controller.js', 'microinteractions.js', 'moments-interactions.js',
  'styles.css', 'mobile-fixes.css', 'native-ui.css', 'brand-refresh.css', 'moments.css', 'overnight.css',
  'manifest.webmanifest', 'icon.svg', 'sw.js'
];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${file}`);
}
JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));

const html = fs.readFileSync('index.html', 'utf8');
const requiredIds = [
  'stationButton','favoriteToggle','notifyButton','shareButton','openStations','openSettings','openDataInfo',
  'stationDialog','settingsDialog','dataDialog','countdown','timeline','favoriteCards','momentList','rareBanner','watchedCount'
];
for (const id of requiredIds) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing required UI id: ${id}`);
}
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
const duplicates=ids.filter((id,i)=>ids.indexOf(id)!==i);
if (duplicates.length) throw new Error(`Duplicate IDs: ${[...new Set(duplicates)].join(', ')}`);
if (/class="hero-card"[^>]*aria-live=/i.test(html)) throw new Error('Hero countdown must not be aria-live');
if (!/id="notifyButton"[^>]*aria-pressed=/i.test(html)) throw new Error('Notify toggle must expose aria-pressed');
if (!html.includes('./train-engine.js') || !html.includes('./moments.css')) throw new Error('Moment experience assets are not loaded');

for (const file of ['styles.css','brand-refresh.css','mobile-fixes.css','native-ui.css','moments.css','overnight.css']) {
  const css=fs.readFileSync(file,'utf8');
  const tiny=[...css.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)].map(m=>Number(m[1])).filter(size=>size<13);
  if (tiny.length) throw new Error(`${file} contains font sizes below 13px: ${tiny.join(', ')}`);
}
const brandCss=fs.readFileSync('brand-refresh.css','utf8');
if (!brandCss.includes('--tap-min: 44px')) throw new Error('44px touch-target token is missing');
if (!brandCss.includes('prefers-reduced-motion')) throw new Error('Reduced-motion support is missing');
if (!brandCss.includes('prefers-contrast: more')) throw new Error('Increased-contrast support is missing');

const appJs=fs.readFileSync('app.js','utf8');
if (appJs.includes("setAttribute('open'")) throw new Error('app.js must not manage dialog open state');
if (appJs.includes('Notification.requestPermission')) throw new Error('Do not request system notification permission for page-only alerts');
if (!appJs.includes("action==='arrived'") || !appJs.includes("action==='departed'") || !appJs.includes("action==='seen'")) throw new Error('Observation actions for arrival/departure/pass are missing');
if (!appJs.includes('getOvernightState')) throw new Error('Overnight service state is missing');

const engineJs=fs.readFileSync('train-engine.js','utf8');
if (!engineJs.includes("[0,41,'local']")) throw new Error('Verified TX19 00:41 service is missing');
if (!engineJs.includes('LONG_WAIT_MS')) throw new Error('Long-wait formatting guard is missing');

console.log('Static product QA passed');