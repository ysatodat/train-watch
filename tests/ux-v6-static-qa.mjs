import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const css = read('ux-v6.css');
const ux = read('ux-v6.js');
const rail = read('rail-switch.js');
const onboarding = read('onboarding.js');
const keisei = read('keisei-special.js');
const profile = JSON.parse(read('data/keisei-profile.json'));
const sw = read('sw.js');
const readme = read('README.md');
const credits = read('docs/media-credits.md');

assert(css.includes('grid-template-rows: auto minmax(0, 1fr)'), 'Dialog shell must separate header and body rows');
assert(css.includes('.dialog-body') && css.includes('overflow-y: auto'), 'Dialog body must own vertical scrolling');
assert(css.includes('position: static !important'), 'Dialog header must be static, not sticky');
assert(css.includes('.touchable:not(:disabled):active') && css.includes('--press-overlay'), 'Whole touch areas need pressed feedback');
assert(css.includes('--danger: #b3261e'), 'Warning red must have a dedicated danger token');
assert(css.includes('--brand-coral: #4f7568'), 'TX normal accent must not use warning red');
assert(css.includes('.location-context-button') && css.includes('min-height: 48px'), 'FV location control must read as a 44px+ touch target');

assert(!rail.includes("locationSearch.focus({preventScroll:true})"), 'Changing rail must not focus the search field');
assert(ux.includes("heading.focus({ preventScroll: true })"), 'Dialog opening should focus the heading instead of Close');
assert(ux.includes("root.classList.add('keyboard-nav')"), 'Focus-ring behavior must preserve keyboard navigation');
assert(ux.includes("TX専用") && ux.includes("TRAIN WATCH · 非公式"), 'Legacy TX-only copy must be normalized');

assert(onboarding.includes('./ux-v6.css') && onboarding.includes('./ux-v6.js'), 'UX v6 assets must load');
assert(onboarding.includes('./keisei-special.js'), 'Keisei-specific experience must load');
assert(keisei.includes('京成ならでは') && keisei.includes('京成 車両ずかん'), 'Keisei-specific section and guide must exist');
assert(keisei.includes("new Set(['skyliner', 'morningLiner', 'eveningLiner'])"), 'Keisei liner feature must use timetable service kinds');

assert(profile.featuredVehicles?.length === 4, 'Keisei guide should feature exactly four easy-to-spot vehicles');
for (const id of ['AE', '3200', '3100', '3000']) {
  const vehicle = profile.featuredVehicles.find(v => v.id === id);
  assert(vehicle, `Missing Keisei featured vehicle ${id}`);
  assert(vehicle.image?.page?.includes('commons.wikimedia.org'), `${id} must use a Commons source page`);
  assert(vehicle.image?.author && vehicle.image?.license && vehicle.image?.licenseUrl, `${id} attribution must be complete`);
  assert(vehicle.officialUrl?.startsWith('https://www.keisei.co.jp/'), `${id} must link to an official Keisei source`);
}

assert(sw.includes("densha-kuruyo-v29"), 'Service worker cache must be v29');
for (const asset of ['./ux-v6.css','./ux-v6.js','./keisei-special.js','./data/keisei-profile.json']) {
  assert(sw.includes(asset), `Service worker must cache ${asset}`);
}
assert(readme.includes('赤は通常のアクセント') && readme.includes('京成 車両ずかん'), 'README must describe new palette and Keisei experience');
assert(!readme.includes('TX専用体験'), 'README must not describe the product experience as TX-only');
assert(credits.includes('AE形（スカイライナー）') && credits.includes('3200形'), 'Media credits must include Keisei photos');

console.log('UX v6 static QA passed');
