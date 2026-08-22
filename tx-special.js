(async () => {
  'use strict';

  const E = await (window.TrainWatchEngineReady || Promise.resolve(window.TrainWatchEngine));
  if (!E || window.__trainWatchTxSpecialInitialized) return;
  window.__trainWatchTxSpecialInitialized = true;

  let profile = null;
  try {
    const response = await fetch('./data/tx-profile.json', { cache: 'no-cache' });
    if (response.ok) profile = await response.json();
  } catch {}

  const $ = id => document.getElementById(id);
  const stationCode = $('stationCode');
  const stationDialog = $('stationDialog');
  const stationList = $('stationList');
  const momentsSection = document.querySelector('.moments-section');
  if (!stationCode || !stationDialog || !stationList || !momentsSection) return;

  function currentStationId() {
    const id = stationCode.textContent.trim();
    return E.STATIONS.some(s => s.id === id) ? id : 'TX19';
  }

  function stationIndex(id) {
    return E.stationById(id).i;
  }

  function applyTxIdentity() {
    document.documentElement.dataset.rail = 'tx';
    document.body.classList.add('tx-dedicated-app');

    const brandSub = document.querySelector('.brand-lockup small');
    if (brandSub) {
      brandSub.textContent = 'TX専用・非公式';
      brandSub.setAttribute('aria-label', 'つくばエクスプレス専用の非公式ファンツール');
    }

    const footerLabel = document.querySelector('.app-footer p');
    if (footerLabel) footerLabel.textContent = 'でんしゃくるよ！ β · TX専用・非公式';

    const firstTutorialCopy = document.querySelector('[data-tutorial-step="0"] > p:last-child');
    if (firstTutorialCopy) firstTutorialCopy.textContent = 'TX01 秋葉原〜TX20 つくば。20駅から選ぶだけ。';
  }

  function enhanceStationChooser() {
    stationDialog.classList.add('tx-route-dialog');
    const title = $('stationDialogTitle');
    if (title) title.textContent = 'TXの駅をえらぶ';
    if (!stationDialog.querySelector('.tx-route-intro')) {
      const intro = document.createElement('p');
      intro.className = 'tx-route-intro';
      intro.textContent = 'つくばエクスプレス専用。秋葉原 TX01 から つくば TX20 まで、20駅の路線図からえらべます。';
      stationList.before(intro);
    }
    stationList.setAttribute('aria-label', 'つくばエクスプレス20駅の模式路線図');
  }

  function buildFutureVisits(now, stationId) {
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const all = [...E.buildVisits(now, stationId), ...E.buildVisits(tomorrowStart, stationId)];
    const seen = new Set();
    return all
      .filter(v => +v.stationAt > +now)
      .sort((a, b) => a.stationAt - b.stationAt)
      .filter(v => {
        const key = `${v.dir}:${+v.stationAt}:${v.kind}:${v.stop}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function findNextPass(now, stationId) {
    return buildFutureVisits(now, stationId).find(v => !v.stop) || null;
  }

  function findNextRare(now, stationId) {
    const limit = +now + 18 * 60 * 60_000;
    const visits = buildFutureVisits(now, stationId).filter(v => +v.stationAt <= limit);
    for (let i = 0; i < visits.length; i++) {
      const a = visits[i];
      for (let j = i + 1; j < visits.length; j++) {
        const b = visits[j];
        const diff = +b.stationAt - +a.stationAt;
        if (diff > 75_000) break;
        if (a.dir !== b.dir) return { a, b, diffMs: diff };
      }
    }
    return null;
  }

  function approxWait(ms) {
    if (ms <= 45_000) return 'もうすぐ';
    const mins = Math.max(1, Math.round(ms / 60_000));
    if (mins < 60) return `約${mins}分後`;
    const hours = Math.round(mins / 60);
    return `約${hours}時間後`;
  }

  function availableVehicles(stationId) {
    if (!profile?.vehicles) return [];
    const index = stationIndex(stationId);
    return profile.vehicles.filter(vehicle => {
      const from = stationIndex(vehicle.serviceRange.from);
      const to = stationIndex(vehicle.serviceRange.to);
      return index >= Math.min(from, to) && index <= Math.max(from, to);
    });
  }

  function ensureSpecialSection() {
    let section = $('txSpecial');
    if (section) return section;
    section = document.createElement('section');
    section.id = 'txSpecial';
    section.className = 'tx-special-section';
    section.setAttribute('aria-labelledby', 'txSpecialTitle');
    section.innerHTML = `
      <div class="tx-special-heading">
        <div><h2 id="txSpecialTitle">TXならでは</h2><p id="txSpecialStation">この駅の、ちょっと楽しい見どころ。</p></div>
        <button id="openTxVehicleGuide" type="button" class="tx-vehicle-guide-link touchable">車両ずかん</button>
      </div>
      <div class="tx-highlight-list">
        <div class="tx-highlight-row" id="txNextPassRow">
          <div class="tx-highlight-copy"><span>次のビューン</span><strong id="txNextPassTitle">探しています</strong></div>
          <div class="tx-highlight-time" id="txNextPassTime">—</div>
          <p class="tx-highlight-meta" id="txNextPassMeta">通過する電車を探しています。</p>
        </div>
        <div class="tx-highlight-row" id="txNextRareRow">
          <div class="tx-highlight-copy"><span>次のほぼ同時</span><strong id="txNextRareTitle">探しています</strong></div>
          <div class="tx-highlight-time" id="txNextRareTime">—</div>
          <p class="tx-highlight-meta" id="txNextRareMeta">上下線が近いタイミングを探しています。</p>
        </div>
        <div class="tx-highlight-row" id="txVehicleAtStationRow">
          <div class="tx-highlight-copy"><span>この駅で会えるTX</span><strong id="txVehicleAtStationTitle">確認しています</strong></div>
          <div class="tx-highlight-time" id="txVehicleAtStationCount">—</div>
          <p class="tx-highlight-meta" id="txVehicleAtStationMeta"></p>
        </div>
      </div>`;
    momentsSection.insertAdjacentElement('afterend', section);
    return section;
  }

  function vehicleCollection() {
    try {
      const value = JSON.parse(localStorage.getItem('denshaKuruyoVehicleCollectionV1') || '[]');
      return new Set(Array.isArray(value) ? value : []);
    } catch { return new Set(); }
  }

  function saveVehicleCollection(set) {
    try { localStorage.setItem('denshaKuruyoVehicleCollectionV1', JSON.stringify([...set])); } catch {}
  }

  let vehicleDialog = null;
  let vehicleTrigger = null;
  let renderedVehicleStationId = null;

  function isVehicleAvailable(vehicle, stationId) {
    const index = stationIndex(stationId);
    const from = stationIndex(vehicle.serviceRange.from);
    const to = stationIndex(vehicle.serviceRange.to);
    return index >= Math.min(from, to) && index <= Math.max(from, to);
  }

  function updateFoundButton(button, isFound) {
    if (!button || button.disabled) return;
    button.setAttribute('aria-pressed', String(isFound));
    button.textContent = isFound ? '見つけた ✓' : '見つけた！';
  }

  function ensureVehicleDialog() {
    if (vehicleDialog || !profile?.vehicles?.length) return vehicleDialog;
    vehicleDialog = document.createElement('dialog');
    vehicleDialog.id = 'txVehicleDialog';
    vehicleDialog.className = 'native-dialog tx-vehicle-dialog';
    vehicleDialog.setAttribute('aria-labelledby', 'txVehicleDialogTitle');
    vehicleDialog.innerHTML = `
      <div class="dialog-shell">
        <header class="dialog-header">
          <h2 id="txVehicleDialogTitle">TX車両ずかん</h2>
          <button type="button" class="dialog-close touchable" data-tx-vehicle-close aria-label="閉じる">×</button>
        </header>
        <p class="tx-vehicle-lead">TXには3つの車種があります。見つけたら、ずかんに記録してみよう。</p>
        <p class="tx-vehicle-summary" id="txVehicleSummary"></p>
        <div class="tx-vehicle-list" id="txVehicleList"></div>
        <p class="tx-media-note">写真はWikimedia Commonsの再利用可能な作品です。作者とライセンスを各写真に表示しています。</p>
      </div>`;
    document.body.appendChild(vehicleDialog);

    vehicleDialog.querySelector('[data-tx-vehicle-close]').addEventListener('click', closeVehicleDialog);
    vehicleDialog.addEventListener('click', event => { if (event.target === vehicleDialog) closeVehicleDialog(); });
    vehicleDialog.addEventListener('close', () => {
      if (vehicleTrigger && document.contains(vehicleTrigger)) {
        try { vehicleTrigger.focus({ preventScroll: true }); } catch {}
      }
    });
    vehicleDialog.addEventListener('click', event => {
      const button = event.target.closest('.tx-found-button');
      if (!button || button.disabled) return;
      const found = vehicleCollection();
      const id = button.dataset.vehicleId;
      const nextFound = !found.has(id);
      if (nextFound) found.add(id); else found.delete(id);
      saveVehicleCollection(found);
      updateFoundButton(button, nextFound);
    });
    return vehicleDialog;
  }

  function renderVehicleDialog({ force = false } = {}) {
    const dialog = ensureVehicleDialog();
    if (!dialog || !profile) return;
    const stationId = currentStationId();
    const station = E.stationById(stationId);
    const available = availableVehicles(stationId);
    const found = vehicleCollection();
    const summary = $('txVehicleSummary');
    const list = $('txVehicleList');
    if (summary) summary.textContent = `${station.name}駅で会えるのは ${available.length}種類。`;
    if (!list) return;

    if (!force && renderedVehicleStationId === stationId && list.childElementCount === profile.vehicles.length) {
      list.querySelectorAll('.tx-found-button').forEach(button => updateFoundButton(button, found.has(button.dataset.vehicleId)));
      return;
    }

    renderedVehicleStationId = stationId;
    list.innerHTML = profile.vehicles.map(vehicle => {
      const canMeet = isVehicleAvailable(vehicle, stationId);
      const isFound = found.has(vehicle.id);
      const foundLabel = isFound ? '見つけた ✓' : '見つけた！';
      const status = canMeet ? `${station.name}駅で会えるよ` : `この駅には来ないよ（${vehicle.rangeText}を走ります）`;
      return `<article class="tx-vehicle-item ${canMeet ? '' : 'is-unavailable'}" data-vehicle="${vehicle.id}">
        <img class="tx-vehicle-photo" src="${vehicle.image.src}" alt="${vehicle.label}の実車写真" loading="lazy" decoding="async" referrerpolicy="no-referrer">
        <div class="tx-vehicle-head"><h3>${vehicle.label}</h3><span class="tx-vehicle-range">${vehicle.rangeText}</span></div>
        <p class="tx-vehicle-hint">${vehicle.kidHint}</p>
        <p class="tx-vehicle-status">${status}</p>
        <div class="tx-vehicle-actions">
          <button type="button" class="tx-found-button touchable" data-vehicle-id="${vehicle.id}" aria-pressed="${isFound}" ${canMeet ? '' : 'disabled'}>${canMeet ? foundLabel : 'この駅では会えない'}</button>
          <p class="tx-vehicle-credit">写真: <a href="${vehicle.image.page}" target="_blank" rel="noopener">${vehicle.image.author}</a> / <a href="${vehicle.image.licenseUrl}" target="_blank" rel="noopener">${vehicle.image.license}</a></p>
        </div>
      </article>`;
    }).join('');
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

  function refreshSpecial() {
    const section = ensureSpecialSection();
    const stationId = currentStationId();
    const station = E.stationById(stationId);
    const now = new Date();
    const pass = findNextPass(now, stationId);
    const rare = findNextRare(now, stationId);
    const vehicles = availableVehicles(stationId);

    const stationText = $('txSpecialStation');
    if (stationText) stationText.textContent = `${station.name}で、見逃したくないTXの瞬間。`;

    const passTitle = $('txNextPassTitle');
    const passTime = $('txNextPassTime');
    const passMeta = $('txNextPassMeta');
    if (pass) {
      const service = E.SERVICE[pass.kind]?.label || '電車';
      passTitle.textContent = `${service}が通過`;
      passTime.textContent = approxWait(+pass.stationAt - +now);
      passMeta.textContent = `${pass.time}ごろ · ${E.dirText(pass)} · 通過時刻は目安`;
    } else {
      passTitle.textContent = 'この駅は通過が少なめ';
      passTime.textContent = '—';
      passMeta.textContent = '現在のダイヤで、次の通過を確認できませんでした。';
    }

    const rareTitle = $('txNextRareTitle');
    const rareTime = $('txNextRareTime');
    const rareMeta = $('txNextRareMeta');
    if (rare) {
      const aService = E.SERVICE[rare.a.kind]?.label || '電車';
      const bService = E.SERVICE[rare.b.kind]?.label || '電車';
      rareTitle.textContent = '上下線がほぼ同時';
      rareTime.textContent = `${rare.a.time}ごろ`;
      rareMeta.textContent = `${aService} ＋ ${bService} · ダイヤ上の目安`;
    } else {
      rareTitle.textContent = '近い時間には見つからず';
      rareTime.textContent = '—';
      rareMeta.textContent = '次の18時間で、上下線がほぼ同時の組み合わせは見つかりませんでした。';
    }

    const vehicleTitle = $('txVehicleAtStationTitle');
    const vehicleCount = $('txVehicleAtStationCount');
    const vehicleMeta = $('txVehicleAtStationMeta');
    if (vehicles.length) {
      vehicleTitle.textContent = vehicles.map(v => v.id.replace('TX-', '') + '系').join('・');
      vehicleCount.textContent = `${vehicles.length}種類`;
      if (stationIndex(stationId) > stationIndex('TX15')) {
        vehicleMeta.textContent = 'TX-1000系は守谷まで。ここでは2000系・3000系に会えます。';
      } else {
        vehicleMeta.textContent = '1000系・2000系・3000系。見た目の違いも探してみよう。';
      }
    } else {
      vehicleTitle.textContent = '車両情報を確認中';
      vehicleCount.textContent = '—';
      vehicleMeta.textContent = '';
    }

    const guideButton = $('openTxVehicleGuide');
    if (guideButton) {
      guideButton.hidden = !profile?.vehicles?.length;
      if (!guideButton.dataset.bound) {
        guideButton.dataset.bound = '1';
        guideButton.addEventListener('click', openVehicleDialog);
      }
    }

    section.dataset.station = stationId;
  }

  applyTxIdentity();
  enhanceStationChooser();
  ensureSpecialSection();
  if (profile?.vehicles?.length) ensureVehicleDialog();
  refreshSpecial();

  let observedStationId = currentStationId();
  const observer = new MutationObserver(() => {
    const nextStationId = currentStationId();
    if (nextStationId === observedStationId) return;
    observedStationId = nextStationId;
    refreshSpecial();
    if (vehicleDialog?.open) renderVehicleDialog({ force: true });
  });
  observer.observe(stationCode, { childList: true, subtree: true, characterData: true });

  const timer = window.setInterval(refreshSpecial, 15_000);
  window.addEventListener('pagehide', () => {
    window.clearInterval(timer);
    observer.disconnect();
  }, { once: true });
})();
