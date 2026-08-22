import fs from 'node:fs';

const requiredFiles = [
  'index.html', 'app.js', 'dialog-controller.js', 'microinteractions.js',
  'styles.css', 'mobile-fixes.css', 'native-ui.css', 'brand-refresh.css',
  'manifest.webmanifest', 'icon.svg', 'sw.js'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${file}`);
}

JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));

const html = fs.readFileSync('index.html', 'utf8');
const requiredIds = [
  'stationButton', 'favoriteToggle', 'notifyButton', 'shareButton',
  'openStations', 'openSettings', 'openDataInfo',
  'stationDialog', 'settingsDialog', 'dataDialog',
  'countdown', 'timeline', 'favoriteCards'
];
for (const id of requiredIds) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing required UI id: ${id}`);
}

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
if (duplicates.length) throw new Error(`Duplicate IDs: ${[...new Set(duplicates)].join(', ')}`);

const brandCss = fs.readFileSync('brand-refresh.css', 'utf8');
const tooSmallPx = [...brandCss.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)]
  .map(m => Number(m[1]))
  .filter(size => size < 13);
if (tooSmallPx.length) throw new Error(`brand-refresh.css contains font sizes below 13px: ${tooSmallPx.join(', ')}`);

if (!brandCss.includes('--tap-min: 44px')) throw new Error('44px touch-target token is missing');
if (!brandCss.includes('prefers-reduced-motion')) throw new Error('Reduced-motion support is missing');
if (!brandCss.includes('prefers-contrast: more')) throw new Error('Increased-contrast support is missing');

console.log('Static product QA passed');
