(() => {
  'use strict';

  const STATIONS = [
    ['TX01','秋葉原','Akihabara'],['TX02','新御徒町','Shin-okachimachi'],['TX03','浅草','Asakusa'],['TX04','南千住','Minami-senju'],['TX05','北千住','Kita-senju'],['TX06','青井','Aoi'],['TX07','六町','Rokucho'],['TX08','八潮','Yashio'],['TX09','三郷中央','Misato-chuo'],['TX10','南流山','Minami-nagareyama'],['TX11','流山セントラルパーク','Nagareyama-centralpark'],['TX12','流山おおたかの森','Nagareyama-otakanomori'],['TX13','柏の葉キャンパス','Kashiwanoha-campus'],['TX14','柏たなか','Kashiwa-tanaka'],['TX15','守谷','Moriya'],['TX16','みらい平','Miraidaira'],['TX17','みどりの','Midorino'],['TX18','万博記念公園','Bampaku-kinenkoen'],['TX19','研究学園','Kenkyu-gakuen'],['TX20','つくば','Tsukuba']
  ].map((x, i) => ({ id:x[0], name:x[1], en:x[2], i }));

  const DOWN = {
    local:   [0,2,4,7,10,13,15,19,22,25,28,30,33,36,40,45,48,51,54,57],
    section: [0,2,4,7,10,null,null,17,20,23,null,26,30,null,35,40,43,46,49,52],
    rapid:   [0,2,4,7,10,null,null,17,null,21,null,25,null,null,32,null,null,null,null,45]
  };
  const UP = {
    local:   [66,63,61,58,55,52,50,46,43,40,37,34,31,29,24,13,9,6,3,0],
    section: [54,51,49,46,43,null,null,37,33,30,null,27,23,null,18,13,10,7,3,0],
    rapid:   [45,43,41,38,35,null,null,28,null,24,null,20,null,null,13,null,null,null,null,0]
  };
  const SERVICE = {
    local:{ label:'普通' },
    section:{ label:'区間快速' },
    rapid:{ label:'快速' }
  };

  const DEFAULT_STATE = {
    station:'TX19', includePass:true, dir:'both', favorites:['TX19'], sound:true, vibrate:true
  };
  const state = { ...DEFAULT_STATE };
  let alertsEnabled = false;
  let audioCtx = null;
  let toastTimer = null;
  const notified = new Set();

  const $ = id => document.getElementById(id);
  const el = {
    clock:$('clock'), date:$('date'), stationCode:$('stationCode'), stationName:$('stationName'),
    stationButton:$('stationButton'), favoriteToggle:$('favoriteToggle'), dataNotice:$('dataNotice'), modeBadge:$('modeBadge'),
    hero:$('hero'), heroLabel:$('heroLabel'), countdown:$('countdown'), heroMessage:$('heroMessage'), tenCount:$('tenCount'),
    serviceBadge:$('serviceBadge'), metaRow:$('metaRow'), trainWrap:$('trainWrap'), notifyButton:$('notifyButton'),
    sessionNote:$('sessionNote'), favoriteCards:$('favoriteCards'), timeline:$('timeline'),
    stationDialog:$('stationDialog'), stationSearch:$('stationSearch'), stationList:$('stationList'),
    settingsDialog:$('settingsDialog'), soundToggle:$('soundToggle'), vibrateToggle:$('vibrateToggle'),
    dataDialog:$('dataDialog'), toast:$('toast')
  };

  function loadState() {
    try { Object.assign(state, JSON.parse(localStorage.getItem('denshaKuruyoV1') || '{}')); } catch {}
    const params = new URLSearchParams(location.search);
    const q = params.get('station');
    if (STATIONS.some(s => s.id === q)) state.station = q;
    if (!Array.isArray(state.favorites)) state.favorites = ['TX19'];
    state.favorites = [...new Set(state.favorites)].filter(id => STATIONS.some(s => s.id === id));
  }
  function saveState() { localStorage.setItem('denshaKuruyoV1', JSON.stringify(state)); }
  function stationById(id=state.station) { return STATIONS.find(s => s.id === id) || STATIONS[18]; }
  function minutes(h,m) { return h*60+m; }
  function targetFrom(baseMin, offset, day, extra) {
    const d = new Date(day); d.setHours(0,0,0,0); d.setMinutes(baseMin + offset);
    return { ...extra, target:d, time:`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` };
  }
  function interpolate(arr, index, baseline) {
    if (arr[index] != null) return { offset:arr[index], approx:false };
    let l=index-1, r=index+1;
    while (l>=0 && arr[l]==null) l--;
    while (r<arr.length && arr[r]==null) r++;
    if (l<0 || r>=arr.length) return { offset:null, approx:true };
    const p=(baseline[index]-baseline[l])/(baseline[r]-baseline[l]);
    return { offset:arr[l] + (arr[r]-arr[l])*p, approx:true };
  }
  function buildEvents(now, stationId) {
    const s=stationById(stationId), out=[], baseDay=new Date(now); baseDay.setHours(0,0,0,0);
    for (let h=8; h<=23; h++) {
      const downBases=[['rapid',0],['section',16],['local',27],['rapid',30],['section',46],['local',57]];
      const upBases=[['local',4],['rapid',12],['section',20],['local',34],['rapid',42],['section',50]];
      downBases.forEach(([kind,m]) => {
        const inf=interpolate(DOWN[kind],s.i,DOWN.local); if(inf.offset==null) return;
        out.push(targetFrom(minutes(h,m),inf.offset,baseDay,{kind,dir:'down',stop:DOWN[kind][s.i]!=null,approx:inf.approx,id:`d-${h}-${m}-${kind}-${s.id}`}));
      });
      upBases.forEach(([kind,m]) => {
        const inf=interpolate(UP[kind],s.i,UP.local); if(inf.offset==null) return;
        out.push(targetFrom(minutes(h,m),inf.offset,baseDay,{kind,dir:'up',stop:UP[kind][s.i]!=null,approx:inf.approx,id:`u-${h}-${m}-${kind}-${s.id}`}));
      });
    }
    return out.filter(e => e.target-now > -3500).sort((a,b)=>a.target-b.target);
  }
  function filteredEvents(now, stationId=state.station) {
    return buildEvents(now, stationId).filter(e => (state.includePass || e.stop) && (state.dir==='both' || e.dir===state.dir));
  }
  function secondsLeft(e, now) { return Math.max(0, Math.ceil((e.target-now)/1000)); }
  function fmtClock(ms) { const s=Math.max(0,Math.ceil(ms/1000)); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
  function fmtRemain(ms) { const s=Math.max(0,Math.ceil(ms/1000)); return s<60 ? `あと${s}秒` : `あと${Math.floor(s/60)}分${String(s%60).padStart(2,'0')}秒`; }
  function dirText(e) { return e.dir==='down' ? 'つくば方面' : '秋葉原方面'; }
  function isOrigin(e, stationId=state.station) { return (e.dir==='down'&&stationId==='TX01') || (e.dir==='up'&&stationId==='TX20'); }
  function heroMessage(e, sec) {
    const origin=isOrigin(e);
    if (sec<=10) return origin ? 'もうすぐ発車！いっしょに数えよう！' : 'きたきた！いっしょに数えよう！';
    if (sec<=30) return origin ? 'そろそろ発車するよ！' : 'もう来るよ！電車を見よう！';
    if (sec<=180) return origin ? '発車のじゅんびをしよう！' : 'そろそろ来るよ！';
    return e.stop ? 'でんしゃを待とう！' : 'ビューンと通る電車を待とう！';
  }
  function showToast(text, urgent=false) {
    clearTimeout(toastTimer); el.toast.textContent=text; el.toast.hidden=false; el.toast.classList.toggle('urgent', urgent);
    toastTimer=setTimeout(()=>{el.toast.hidden=true;},4500);
  }
  function beep(urgent=false) {
    if (!state.sound) return;
    try {
      audioCtx=audioCtx || new (window.AudioContext||window.webkitAudioContext)();
      if (audioCtx.state==='suspended') audioCtx.resume();
      const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value=urgent?880:660; g.gain.setValueAtTime(.0001,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.11,audioCtx.currentTime+.02); g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+.22); o.start(); o.stop(audioCtx.currentTime+.24);
    } catch {}
  }
  function buzz() { if (state.vibrate && navigator.vibrate) navigator.vibrate([110,60,110]); }
  function fireAlert(e, threshold) {
    const key=`${e.id}-${threshold}`; if(notified.has(key)) return; notified.add(key);
    const origin=isOrigin(e);
    const text=threshold===30 ? (origin?'🚆 もうすぐ発車するよ！':'👀 もう来るよ！電車を見よう！') : (origin?'🔔 そろそろ発車するよ！':'🚆 そろそろ電車が来るよ！');
    showToast(text, threshold===30); beep(threshold===30); if(threshold===30) buzz();
  }
  function maybeAlert(e, sec) {
    if (!alertsEnabled) return;
    if (sec<=180 && sec>175) fireAlert(e,180);
    if (sec<=30 && sec>25) fireAlert(e,30);
  }

  function renderFavorites(now) {
    el.favoriteCards.innerHTML='';
    if (!state.favorites.length) {
      el.favoriteCards.innerHTML='<div class="empty-favs">よく見る駅をお気に入りにすると、ここからすぐ切り替えられます。</div>';
      return;
    }
    state.favorites.forEach(id => {
      const s=stationById(id), e=filteredEvents(now,id)[0];
      const b=document.createElement('button');
      b.type='button';
      b.className='favorite-card'+(id===state.station?' active':'');
      b.innerHTML=`<span class="mini-code">${s.id}</span><strong>${s.name}</strong><span class="mini-next">${e?`${SERVICE[e.kind].label} · ${fmtRemain(e.target-now)}`:'今日はおしまい'}</span>`;
      b.setAttribute('aria-label',`${s.name}駅を見る。${e?`${SERVICE[e.kind].label}、${fmtRemain(e.target-now)}`:'今日はおしまい'}`);
      b.addEventListener('click',()=>selectStation(id));
      el.favoriteCards.appendChild(b);
    });
  }
  function renderStationList(filter='') {
    const q=filter.trim().toLowerCase();
    el.stationList.innerHTML='';
    let visibleCount=0;
    STATIONS.forEach(s => {
      const matches=!q || s.name.toLowerCase().includes(q) || s.en.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      if (matches) visibleCount++;
      const row=document.createElement('div'); row.className='station-row'+(s.id===state.station?' current':''); row.hidden=!matches;
      const fav=state.favorites.includes(s.id);
      row.innerHTML=`<span class="station-code-mini">${s.id}</span><button type="button" class="station-select" ${s.id===state.station?'aria-current="true"':''}><strong>${s.name}</strong><small>${s.en}</small></button><button type="button" class="star-btn ${fav?'on':''}" aria-label="${s.name}をお気に入り${fav?'から外す':'に追加'}">${fav?'★':'☆'}</button>`;
      row.querySelector('.station-select').addEventListener('click',()=>selectStation(s.id));
      row.querySelector('.star-btn').addEventListener('click',()=>{toggleFavorite(s.id); renderStationList(el.stationSearch.value);});
      el.stationList.appendChild(row);
    });
    if (!visibleCount) {
      const empty=document.createElement('p');
      empty.className='station-empty';
      empty.textContent='該当する駅がありません。';
      el.stationList.appendChild(empty);
    }
  }
  function selectStation(id) {
    state.station=id; saveState(); const u=new URL(location.href); u.searchParams.set('station',id); history.replaceState(null,'',u); renderAll();
  }
  function toggleFavorite(id=state.station) {
    const i=state.favorites.indexOf(id); if(i>=0) state.favorites.splice(i,1); else state.favorites.push(id);
    saveState(); renderAll();
  }
  function syncControls() {
    document.querySelectorAll('#trainFilter button').forEach(b=>{
      const active=(b.dataset.filter==='all')===state.includePass;
      b.classList.toggle('active',active);
      b.setAttribute('aria-pressed',String(active));
    });
    document.querySelectorAll('#directionFilter button').forEach(b=>{
      const active=b.dataset.dir===state.dir;
      b.classList.toggle('active',active);
      b.setAttribute('aria-pressed',String(active));
    });
    el.soundToggle.checked=state.sound!==false;
    el.vibrateToggle.checked=state.vibrate!==false;
    el.notifyButton.classList.toggle('enabled',alertsEnabled);
    el.notifyButton.setAttribute('aria-pressed',String(alertsEnabled));
    el.notifyButton.querySelector('b').textContent=alertsEnabled?'お知らせ中':'このページでお知らせ';
    el.sessionNote.textContent=alertsEnabled?'3分前と30秒前にお知らせします。ページは開いたままにしてください。':'お知らせは、このページを開いている間だけ動きます。';
  }
  function renderAll() {
    const now=new Date(), s=stationById(), events=filteredEvents(now);
    document.title=`${s.name}駅｜でんしゃくるよ！`; el.stationCode.textContent=s.id; el.stationName.textContent=s.name;
    const fav=state.favorites.includes(s.id); el.favoriteToggle.textContent=fav?'★':'☆'; el.favoriteToggle.classList.toggle('on',fav); el.favoriteToggle.setAttribute('aria-label',fav?'お気に入りから外す':'お気に入りに追加');
    const weekend=[0,6].includes(now.getDay()); el.modeBadge.textContent=weekend?'土休日ダイヤ（β）':'平日参考ダイヤ（β）'; el.dataNotice.classList.toggle('reference',!weekend);
    const e=events[0];
    if (!e) {
      el.countdown.textContent='--:--'; el.heroMessage.textContent='今日の電車はおしまい。またあした！'; el.heroLabel.textContent='つぎの電車まで'; el.serviceBadge.textContent='本日は終了'; el.metaRow.innerHTML=''; el.timeline.innerHTML='<div class="event-row"><div class="event-main"><strong>また明日、電車を見よう！</strong><small>現在のβ版は8:00〜23:59を中心に表示します。</small></div></div>'; renderFavorites(now); syncControls(); return;
    }
    const sec=secondsLeft(e,now); el.countdown.textContent=fmtClock(e.target-now); el.heroMessage.textContent=heroMessage(e,sec);
    el.heroLabel.textContent=e.stop?(isOrigin(e)?'つぎの電車の発車まで':'つぎに駅へ来る電車まで'):'つぎに通る電車まで';
    el.serviceBadge.textContent=SERVICE[e.kind].label; el.hero.classList.toggle('soon',sec<=180); el.hero.classList.toggle('now',sec<=30);
    el.tenCount.hidden=sec>10; el.tenCount.textContent=sec<=10?`いっしょに数えよう！ ${sec}`:'';
    el.metaRow.innerHTML=`<span class="pill ${e.dir}">${dirText(e)}</span><span class="pill">${e.time}ごろ</span><span class="pill ${e.stop?'':'pass'}">${e.stop?'停車':'通過・推定'}</span>`;
    maybeAlert(e,sec);
    el.timeline.innerHTML=events.slice(0,7).map((x,i)=>`<article class="event-row ${i===0?'next':''}" ${i===0?'aria-current="true"':''}><div class="event-time">${x.time}</div><div class="event-main"><strong>${SERVICE[x.kind].label} · ${dirText(x)}</strong><small>${x.stop?'停車':'通過（推定）'}${x.approx?' · 参考時刻':''}</small></div><div class="event-remain">${fmtRemain(x.target-now)}</div></article>`).join('');
    renderFavorites(now); syncControls();
  }

  async function toggleAlerts() {
    alertsEnabled=!alertsEnabled;
    if(alertsEnabled) {
      beep(false);
      const e=filteredEvents(new Date())[0]; if(e && secondsLeft(e,new Date())<=180) fireAlert(e,180);
      showToast('🔔 お知らせをONにしました。ページを開いたまま待ってね。');
    } else showToast('お知らせをOFFにしました');
    syncControls();
  }
  async function shareStation() {
    const s=stationById(), u=new URL(location.href); u.searchParams.set('station',s.id);
    const text=`${s.name}駅で電車を見よう！\n「でんしゃくるよ！」で次の電車までカウントダウンできます。`;
    try {
      if (navigator.share) await navigator.share({title:`${s.name}駅｜でんしゃくるよ！`,text,url:u.href});
      else { await navigator.clipboard.writeText(`${text}\n${u.href}`); showToast('URLをコピーしました'); }
    } catch(e) { if(e.name!=='AbortError') showToast('共有できませんでした'); }
  }

  function bindEvents() {
    el.favoriteToggle.addEventListener('click',()=>toggleFavorite());
    el.notifyButton.addEventListener('click',toggleAlerts); $('shareButton').addEventListener('click',shareStation);
    el.stationSearch.addEventListener('input',()=>renderStationList(el.stationSearch.value));
    document.querySelectorAll('#trainFilter button').forEach(b=>b.addEventListener('click',()=>{state.includePass=b.dataset.filter==='all'; saveState(); renderAll();}));
    document.querySelectorAll('#directionFilter button').forEach(b=>b.addEventListener('click',()=>{state.dir=b.dataset.dir; saveState(); renderAll();}));
    el.soundToggle.addEventListener('change',()=>{state.sound=el.soundToggle.checked; saveState(); if(state.sound) beep(false);});
    el.vibrateToggle.addEventListener('change',()=>{state.vibrate=el.vibrateToggle.checked; saveState();});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden) renderAll();});
  }
  function tick() {
    const now=new Date(); el.clock.textContent=now.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}); el.date.textContent=now.toLocaleDateString('ja-JP',{month:'numeric',day:'numeric',weekday:'short'}); renderAll();
  }
  function init() {
    loadState();
    el.hero.removeAttribute('aria-live');
    el.favoriteCards.removeAttribute('role');
    const settingsButton=$('openSettings'); if(settingsButton) settingsButton.textContent='表示設定';
    bindEvents(); renderStationList(); syncControls(); tick(); setInterval(tick,1000);
    if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  }
  init();
})();