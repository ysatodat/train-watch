const CACHE='densha-kuruyo-v28';
const CORE=['./','./index.html','./styles.css','./mobile-fixes.css','./native-ui.css','./brand-refresh.css','./moments.css','./overnight.css','./product-v4.css','./product-v5.css','./tx-special.css','./rail-switch.css','./observation-v2.css','./dialog-controller.js','./train-engine.js','./keisei-engine.js','./app.js','./onboarding.js','./rail-switch.js','./keisei-ui.js','./tx-special.js','./microinteractions.js','./moments-interactions.js','./data/timetable.json','./data/tx-profile.json','./data/keisei-main-stations.json','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
