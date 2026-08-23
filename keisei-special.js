(async () => {
  'use strict';
  if (window.RailContext?.rail !== 'keisei' || window.__keiseiSpecialInitialized) return;
  window.__keiseiSpecialInitialized = true;

  const E = await (window.TrainWatchEngineReady || Promise.resolve(window.TrainWatchEngine));
  if (!E) return;

  let profile = null;
  try {
    const response = await fetch('./data/keisei-profile.json', { cache: 'no-cache' });
    if (response.ok) profile = await response.json();
  } catch {}

  const $ = id => document.getElementById(id);
  const stationCode = $('stationCode');
  const momentsSection = document.querySelector('.moments-section');
  if (!stationCode || !momentsSection) return;

  const linerKinds = new Set(['skyliner', 'morningLiner', 'eveningLiner']);
  const airportKinds = new Set(['skyliner', 'accessExpress']);
  const collectionKey = 'denshaKuruyoKeiseiVehicleCollectionV1';

  function stationId() {
    const id = stationCode.textContent.trim();
    return E.STATIONS.some(s => s.id === id) ? id : E.DEFAULT_STATION;
  }

  function futureVisits(now = new Date()) {
    return E.buildVisits(now, stationId())
      .filter(v => +v.stationAt > +now)
      .sort((a, b) => a.stationAt - b.stationAt);
  }

  function waitLabel(visit, now) {
    const ms = +visit.stationAt - +now;
    if (ms < 60_000) return 'もうすぐ';
    if (ms < 60 * 60_000) return `あと${Math.max(1, Math.round(ms / 60_000))}分`;
    return visit.time;
  }

  function serviceLabel(visit) {
    return E.SERVICE?.[visit.kind]?.label || '電車';
  }

  function destinationLooksLikeAirport(visit) {
    return /airport|narita|空港/i.test(String(visit.destination || ''));
  }

  function ensureSection() {
    let section = $('keiseiSpecial');
    if (section) return section;
    section = document.createElement('section');
    section.id = 'keiseiSpecial';
    section.className = 'keisei-special-section';
    section.setAttribute('aria-labelledby', 'keiseiSpecialTitle');
    section.innerHTML = `
      <div class="keisei-special-heading">
        <div><h2 id="keiseiSpecialTitle">京成ならでは</h2><p id="keiseiSpecialStation">この駅から楽しめる、京成らしい見どころ。</p></div>
        <button id="openKeiseiVehicleGuide" type="button" class="keisei-vehicle-open touchable">車両ずかん</button>
      </div>
      <div class="keisei-highlight-list">
        <div class="keisei-highlight-row" id="keiseiLinerRow">
          <span>次のライナー</span><strong id="keiseiLinerTitle">探しています</strong><div class="keisei-highlight-time" id="keiseiLinerTime">—</div>
          <p class="keisei-highlight-meta" id="keiseiLinerMeta">この駅に停まるライナーを確認しています。</p>
        </div>
        <div class="keisei-highlight-row" id="keiseiAirportRow">
          <span>空港へ向かう電車</span><strong id="keiseiAirportTitle">探しています</strong><div class="keisei-highlight-time" id="keiseiAirportTime">—</div>
          <p class="keisei-highlight-meta" id="keiseiAirportMeta">成田空港方面の注目列車を確認しています。</p>
        </div>
      </div>`;
    momentsSection.insertAdjacentElement('afterend', section);
    $('openKeiseiVehicleGuide')?.addEventListener('click', openVehicleDialog);
    return section;
  }

  function refreshHighlights() {
    ensureSection();
    const now = new Date();
    const station = E.stationById(stationId());
    const visits = futureVisits(now);
    const liner = visits.find(v => linerKinds.has(v.kind));
    const airport = visits.find(v => v.dir === 'down' && (airportKinds.has(v.kind) || destinationLooksLikeAirport(v)));

    const stationCopy = $('keiseiSpecialStation');
    if (stationCopy) stationCopy.textContent = `${station.name}で、京成らしい1本を探してみよう。`;

    if (liner) {
      $('keiseiLinerTitle').textContent = serviceLabel(liner);
      $('keiseiLinerTime').textContent = waitLabel(liner, now);
      $('keiseiLinerMeta').textContent = `${liner.time}発 · ${E.dirText(liner)} · 公式駅時刻表`; 
    } else {
      $('keiseiLinerTitle').textContent = 'この駅に停まる便は見つからず';
      $('keiseiLinerTime').textContent = '—';
      $('keiseiLinerMeta').textContent = '通過するライナーの時刻は、現在のβ版では推測しません。';
    }

    if (airport) {
      $('keiseiAirportTitle').textContent = `${serviceLabel(airport)} · ${airport.destination || '成田空港方面'}`;
      $('keiseiAirportTime').textContent = waitLabel(airport, now);
      $('keiseiAirportMeta').textContent = `${airport.time}発 · 成田・空港方面`;
    } else {
      $('keiseiAirportTitle').textContent = '次の対象列車を確認できず';
      $('keiseiAirportTime').textContent = '—';
      $('keiseiAirportMeta').textContent = '通常の「いま・もうすぐ」には、この駅の停車列車が引き続き表示されます。';
    }
  }

  function readCollection() {
    try {
      const value = JSON.parse(localStorage.getItem(collectionKey) || '[]');
      return new Set(Array.isArray(value) ? value : []);
    } catch { return new Set(); }
  }

  function writeCollection(set) {
    try { localStorage.setItem(collectionKey, JSON.stringify([...set])); } catch {}
  }

  let vehicleDialog = null;
  let vehicleTrigger = null;
  let vehicleRendered = false;

  function updateFoundButton(button, found) {
    if (!button) return;
    button.setAttribute('aria-pressed', String(found));
    button.textContent = found ? '見つけた ✓' : '見つけた！';
  }

  function ensureVehicleDialog() {
    if (vehicleDialog || !profile?.featuredVehicles?.length) return vehicleDialog;
    vehicleDialog = document.createElement('dialog');
    vehicleDialog.id = 'keiseiVehicleDialog';
    vehicleDialog.className = 'native-dialog keisei-vehicle-dialog';
    vehicleDialog.setAttribute('aria-labelledby', 'keiseiVehicleDialogTitle');
    vehicleDialog.innerHTML = `
      <div class="dialog-shell">
        <header class="dialog-header">
          <h2 id="keiseiVehicleDialogTitle">京成 車両ずかん</h2>
          <button type="button" class="dialog-close touchable" data-keisei-vehicle-close aria-label="閉じる">×</button>
        </header>
        <div class="dialog-body">
          <p class="keisei-vehicle-lead">京成の現役車両から、親子で見分けやすい4車種をピックアップ。見つけたら記録できます。</p>
          <p class="keisei-vehicle-summary" id="keiseiVehicleSummary"></p>
          <div class="keisei-vehicle-list" id="keiseiVehicleList"></div>
          <details class="keisei-other-vehicles"><summary>ほかの現役車両も見る</summary><ul id="keiseiOtherVehicleList"></ul></details>
          <p class="keisei-source-note">車両の特徴は <a href="${profile.officialSource}" target="_blank" rel="noopener">京成電鉄の車両図鑑</a> を参照。写真はWikimedia Commonsの再利用可能な作品で、作者・ライセンスを各写真に表示しています。</p>
        </div>
      </div>`;
    document.body.appendChild(vehicleDialog);

    vehicleDialog.querySelector('[data-keisei-vehicle-close]')?.addEventListener('click', closeVehicleDialog);
    vehicleDialog.addEventListener('click', event => { if (event.target === vehicleDialog) closeVehicleDialog(); });
    vehicleDialog.addEventListener('close', () => {
      if (vehicleTrigger && document.contains(vehicleTrigger)) {
        try { vehicleTrigger.focus({ preventScroll: true }); } catch {}
      }
    });
    vehicleDialog.addEventListener('click', event => {
      const button = event.target.closest('.keisei-found-button');
      if (!button) return;
      const found = readCollection();
      const id = button.dataset.vehicleId;
      const next = !found.has(id);
      if (next) found.add(id); else found.delete(id);
      writeCollection(found);
      updateFoundButton(button, next);
      updateSummary();
    });
    return vehicleDialog;
  }

  function updateSummary() {
    const summary = $('keiseiVehicleSummary');
    if (!summary || !profile) return;
    const found = readCollection();
    const count = profile.featuredVehicles.filter(v => found.has(v.id)).length;
    summary.textContent = `${count} / ${profile.featuredVehicles.length} 車種みつけた`;
  }

  function renderVehicleDialog() {
    const dialog = ensureVehicleDialog();
    if (!dialog || !profile) return;
    const found = readCollection();
    const list = $('keiseiVehicleList');
    if (!vehicleRendered && list) {
      list.innerHTML = profile.featuredVehicles.map(vehicle => `
        <article class="keisei-vehicle-item" data-vehicle="${vehicle.id}">
          <img class="keisei-vehicle-photo" src="${vehicle.image.src}" alt="${vehicle.label} ${vehicle.subtitle}の実車写真" loading="lazy" decoding="async" referrerpolicy="no-referrer">
          <div class="keisei-vehicle-head"><h3>${vehicle.label}</h3><span>${vehicle.subtitle}</span></div>
          <p class="keisei-vehicle-hint">${vehicle.kidHint}</p>
          <p class="keisei-vehicle-fact">${vehicle.fact}</p>
          <button type="button" class="keisei-found-button touchable" data-vehicle-id="${vehicle.id}" aria-pressed="${found.has(vehicle.id)}">${found.has(vehicle.id) ? '見つけた ✓' : '見つけた！'}</button>
          <p class="keisei-vehicle-credit">写真: <a href="${vehicle.image.page}" target="_blank" rel="noopener">${vehicle.image.author}</a> / <a href="${vehicle.image.licenseUrl}" target="_blank" rel="noopener">${vehicle.image.license}</a></p>
        </article>`).join('');
      const others = $('keiseiOtherVehicleList');
      if (others) others.innerHTML = (profile.otherCurrentVehicles || []).map(v => `<li><strong>${v.label}</strong> — ${v.note}</li>`).join('');
      vehicleRendered = true;
    } else if (list) {
      list.querySelectorAll('.keisei-found-button').forEach(button => updateFoundButton(button, found.has(button.dataset.vehicleId)));
    }
    updateSummary();
  }

  function openVehicleDialog(event) {
    const dialog = ensureVehicleDialog();
    if (!dialog) return;
    vehicleTrigger = event?.currentTarget || document.activeElement;
    renderVehicleDialog();
    try { if (!dialog.open) dialog.showModal(); } catch { dialog.setAttribute('open', ''); }
  }

  function closeVehicleDialog() {
    if (!vehicleDialog) return;
    try { if (vehicleDialog.open && typeof vehicleDialog.close === 'function') vehicleDialog.close(); else vehicleDialog.removeAttribute('open'); }
    catch { vehicleDialog.removeAttribute('open'); }
  }

  ensureSection();
  refreshHighlights();
  setInterval(refreshHighlights, 30_000);

  new MutationObserver(refreshHighlights).observe(stationCode, { childList: true, characterData: true, subtree: true });
})();
