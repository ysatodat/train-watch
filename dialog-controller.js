(() => {
  'use strict';

  // Resolve rail context before the timetable engine boots. The UI should expose
  // "where are we watching?" rather than leak the underlying rail data model.
  const RAIL_STORAGE_KEY='denshaKuruyoRailContextV1';
  const LOCATION_READY_KEY='denshaKuruyoLocationReadyV1';
  const LOCATION_PENDING_KEY='denshaKuruyoLocationPendingV1';
  const LEGACY_STATE_KEY='denshaKuruyoV1';
  const LEGACY_MOMENTS_KEY='denshaKuruyoMomentsV1';
  const RAILS={
    tx:{id:'tx',label:'TX',name:'つくばエクスプレス',prefix:'TX',defaultStation:'TX19'},
    keisei:{id:'keisei',label:'京成',name:'京成本線',prefix:'KS',defaultStation:'KS22'}
  };

  function safeGet(key){try{return localStorage.getItem(key);}catch{return null;}}
  function safeSet(key,value){try{localStorage.setItem(key,value);}catch{}}
  function safeRemove(key){try{localStorage.removeItem(key);}catch{}}

  let savedRail={};
  try{savedRail=JSON.parse(safeGet(RAIL_STORAGE_KEY)||'{}')||{};}catch{}
  const pageUrl=new URL(location.href);
  const stationParam=pageUrl.searchParams.get('station')||'';
  const requestedRail=pageUrl.searchParams.get('rail');
  const explicitLocation=!!stationParam||!!requestedRail;
  const hadLegacyState=!!safeGet(LEGACY_STATE_KEY);
  const setupPending=safeGet(LOCATION_PENDING_KEY)==='1';
  const setupReady=safeGet(LOCATION_READY_KEY)==='1';
  const needsLocationSetup=setupPending||(!setupReady&&!explicitLocation&&!savedRail.rail&&!hadLegacyState);
  if(needsLocationSetup)safeSet(LOCATION_PENDING_KEY,'1');

  let activeRail=RAILS[requestedRail]?requestedRail:null;
  if(!activeRail&&stationParam.startsWith('KS'))activeRail='keisei';
  if(!activeRail&&stationParam.startsWith('TX'))activeRail='tx';
  if(!activeRail&&RAILS[savedRail.rail])activeRail=savedRail.rail;
  if(!activeRail)activeRail='tx';

  const lastStations={tx:'TX19',keisei:'KS22',...(savedRail.lastStations||{})};
  if(stationParam.startsWith(RAILS[activeRail].prefix))lastStations[activeRail]=stationParam;

  const railKey=(base,rail=activeRail)=>`${base}:${rail}`;
  function defaultState(rail){
    const old=(()=>{try{return JSON.parse(safeGet(LEGACY_STATE_KEY)||'{}')||{};}catch{return{};}})();
    const station=RAILS[rail].defaultStation;
    return JSON.stringify({station,includePass:rail==='tx',dir:'both',favorites:[station],sound:old.sound!==false,vibrate:old.vibrate!==false});
  }
  function parseState(raw,fallbackRail){
    try{return JSON.parse(raw||defaultState(fallbackRail))||JSON.parse(defaultState(fallbackRail));}
    catch{return JSON.parse(defaultState(fallbackRail));}
  }
  function snapshotCurrentRail(){
    const state=safeGet(LEGACY_STATE_KEY);if(state)safeSet(railKey(LEGACY_STATE_KEY),state);
    const moments=safeGet(LEGACY_MOMENTS_KEY);if(moments)safeSet(railKey(LEGACY_MOMENTS_KEY),moments);
  }
  function restoreRailStorage(){
    const specificState=safeGet(railKey(LEGACY_STATE_KEY));
    if(specificState)safeSet(LEGACY_STATE_KEY,specificState);
    else if(activeRail==='tx'&&safeGet(LEGACY_STATE_KEY))safeSet(railKey(LEGACY_STATE_KEY),safeGet(LEGACY_STATE_KEY));
    else safeSet(LEGACY_STATE_KEY,defaultState(activeRail));

    const specificMoments=safeGet(railKey(LEGACY_MOMENTS_KEY));
    if(specificMoments)safeSet(LEGACY_MOMENTS_KEY,specificMoments);
    else if(activeRail==='tx'&&safeGet(LEGACY_MOMENTS_KEY))safeSet(railKey(LEGACY_MOMENTS_KEY),safeGet(LEGACY_MOMENTS_KEY));
    else safeSet(LEGACY_MOMENTS_KEY,JSON.stringify({date:'',events:{}}));
  }
  restoreRailStorage();

  function persistRail(nextRail=activeRail){
    safeSet(RAIL_STORAGE_KEY,JSON.stringify({rail:nextRail,lastStations}));
  }
  function stationFor(rail){return lastStations[rail]||RAILS[rail]?.defaultStation;}
  function rememberStation(id){if(id&&id.startsWith(RAILS[activeRail].prefix)){lastStations[activeRail]=id;persistRail();}}
  function hrefFor(rail,station=stationFor(rail)){
    const u=new URL(location.href);u.searchParams.set('rail',rail);u.searchParams.set('station',station);return u.href;
  }
  function saveTargetStation(rail,station){
    const key=railKey(LEGACY_STATE_KEY,rail);
    const state=parseState(safeGet(key),rail);
    state.station=station;
    if(!Array.isArray(state.favorites))state.favorites=[];
    safeSet(key,JSON.stringify(state));
  }
  function goToLocation(rail,station){
    const config=RAILS[rail];
    if(!config||!station||!station.startsWith(config.prefix))return;
    snapshotCurrentRail();
    saveTargetStation(rail,station);
    lastStations[rail]=station;
    safeSet(LOCATION_READY_KEY,'1');safeRemove(LOCATION_PENDING_KEY);
    persistRail(rail);
    location.href=hrefFor(rail,station);
  }
  function switchRail(rail){
    if(!RAILS[rail]||rail===activeRail)return;
    goToLocation(rail,stationFor(rail));
  }

  if(!stationParam.startsWith(RAILS[activeRail].prefix)){
    pageUrl.searchParams.set('rail',activeRail);pageUrl.searchParams.set('station',stationFor(activeRail));history.replaceState(null,'',pageUrl);
  }else if(!requestedRail){pageUrl.searchParams.set('rail',activeRail);history.replaceState(null,'',pageUrl);}
  if(!needsLocationSetup)persistRail();

  document.documentElement.dataset.rail=activeRail;
  window.RailContext={
    rail:activeRail,rails:RAILS,defaultStation:stationFor(activeRail),stationFor,hrefFor,
    switchRail,goToLocation,rememberStation,snapshotCurrentRail,needsLocationSetup
  };
  window.addEventListener('pagehide',snapshotCurrentRail);

  if(!document.querySelector('link[data-rail-switch]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='./rail-switch.css';link.dataset.railSwitch='1';document.head.appendChild(link);
  }

  if(activeRail==='keisei'){
    let resolveEngine,rejectEngine;
    const ready=new Promise((resolve,reject)=>{resolveEngine=resolve;rejectEngine=reject;});
    window.TrainWatchEngineReady=ready;
    window.__resolveKeiseiEngine=resolveEngine;
    window.__rejectKeiseiEngine=rejectEngine;
    const script=document.createElement('script');script.src='./keisei-engine.js';script.async=false;script.dataset.keiseiEngine='1';
    script.onerror=()=>rejectEngine(new Error('Keisei engine script failed to load'));
    document.head.appendChild(script);
  }

  const DIALOG_IDS = ['stationDialog', 'settingsDialog', 'dataDialog', 'aboutDialog', 'notifyDialog'];
  const dialogs = () => DIALOG_IDS.map(id => document.getElementById(id)).filter(Boolean);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  let lastTrigger = null;
  let previousBodyOverflow = '';

  function animateOpen(dialog) {
    if (reduceMotion || !window.gsap) return;
    const shell = dialog.querySelector('.dialog-shell');
    if (!shell) return;
    window.gsap.killTweensOf(shell);
    window.gsap.fromTo(shell,{ y: 10, opacity: 0 },{ y: 0, opacity: 1, duration: 0.22, ease: 'power2.out', clearProps: 'transform,opacity' });
  }

  function lockPage() {
    if (document.body.dataset.dialogLocked === '1') return;
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.dataset.dialogLocked = '1';
  }

  function unlockPageIfDone() {
    if (dialogs().some(dialog => dialog.open || dialog.classList.contains('fallback-open'))) return;
    document.body.style.overflow = previousBodyOverflow;
    delete document.body.dataset.dialogLocked;
  }

  function closeNow(dialog, { restoreFocus = true } = {}) {
    if (!dialog) return;
    const wasOpen = dialog.open || dialog.hasAttribute('open') || dialog.classList.contains('fallback-open');
    if (!wasOpen) return;
    try {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
    } catch { dialog.removeAttribute('open'); }
    dialog.classList.remove('fallback-open');
    const shell = dialog.querySelector('.dialog-shell');
    if (shell && window.gsap) window.gsap.set(shell, { clearProps: 'transform,opacity' });
    unlockPageIfDone();
    if (restoreFocus && lastTrigger && document.contains(lastTrigger)) {
      requestAnimationFrame(() => { try { lastTrigger.focus({ preventScroll: true }); } catch {} });
    }
  }

  function closeOthers(except) {
    dialogs().forEach(dialog => { if (dialog !== except) closeNow(dialog, { restoreFocus: false }); });
  }

  function prepareStationDialog(dialog) {
    if (!dialog || dialog.id !== 'stationDialog') return;
    const customSearch=document.getElementById('locationSearch');
    if(customSearch&&customSearch.value){customSearch.value='';customSearch.dispatchEvent(new Event('input',{bubbles:true}));}
    const customList=document.getElementById('locationStationList');
    if(customList)customList.scrollTop=0;
    const search = document.getElementById('stationSearch');
    const list = document.getElementById('stationList');
    if (search && search.value) { search.value = ''; search.dispatchEvent(new Event('input', { bubbles: true })); }
    if (list) list.scrollTop = 0;
    setTimeout(() => { const current = dialog.querySelector('.location-station-choice[aria-current="true"],.station-row.current'); if (current) current.scrollIntoView({ block: 'center' }); }, 60);
  }

  function openDialog(dialog, trigger, focusTarget) {
    if (!dialog) return;
    lastTrigger = trigger || document.activeElement;
    closeOthers(dialog);
    if (dialog.open) return;
    if (dialog.hasAttribute('open')) dialog.removeAttribute('open');
    prepareStationDialog(dialog);
    try {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else { dialog.classList.add('fallback-open'); dialog.setAttribute('open', ''); }
    } catch { dialog.classList.add('fallback-open'); dialog.setAttribute('open', ''); }
    lockPage();animateOpen(dialog);
    if (focusTarget && finePointer) {
      setTimeout(() => { if (dialog.open || dialog.classList.contains('fallback-open')) { try { focusTarget.focus({ preventScroll: true }); } catch {} } }, 80);
    }
  }

  function triggerInfo(target) {
    if (target.closest('#stationButton') || target.closest('#openStations')) return {dialog:document.getElementById('stationDialog'),focus:document.getElementById('locationSearch')};
    if (target.closest('#openSettings') || target.closest('#openSettingsFromNotify')) return {dialog:document.getElementById('settingsDialog'),focus:null};
    if (target.closest('#openDataInfo')) return {dialog:document.getElementById('dataDialog'),focus:null};
    if (target.closest('#openAbout') || target.closest('#openAboutFooter')) return {dialog:document.getElementById('aboutDialog'),focus:null};
    if (target.closest('#notifyButton')) return {dialog:document.getElementById('notifyDialog'),focus:null};
    return null;
  }

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const info = triggerInfo(target);
    if (info) { event.preventDefault(); openDialog(info.dialog, target.closest('button'), info.focus); return; }
    const closeButton = target.closest('[data-close-dialog]');
    if (closeButton) { event.preventDefault(); closeNow(document.getElementById(closeButton.dataset.closeDialog)); return; }
    if (target.closest('.station-select')) {
      const stationDialog = document.getElementById('stationDialog');
      if (stationDialog && stationDialog.open) closeNow(stationDialog, { restoreFocus: false });
    }
  }, true);

  dialogs().forEach(dialog => {
    dialog.addEventListener('click', event => { if (event.target === dialog) closeNow(dialog); });
    dialog.addEventListener('close', () => { dialog.classList.remove('fallback-open'); unlockPageIfDone(); });
    dialog.addEventListener('cancel', () => { requestAnimationFrame(unlockPageIfDone); });
  });

  function normalizeAllDialogs() {
    dialogs().forEach(dialog => { if (dialog.open || dialog.hasAttribute('open') || dialog.classList.contains('fallback-open')) closeNow(dialog, { restoreFocus: false }); });
    unlockPageIfDone();
  }

  window.addEventListener('pageshow', event => { if (event.persisted) normalizeAllDialogs(); });
  window.__trainWatchDialogs = { openDialog, closeNow, normalizeAllDialogs };
})();