(async()=>{
  'use strict';
  const ctx=window.RailContext;if(!ctx)return;
  const E=await(window.TrainWatchEngineReady||Promise.resolve(window.TrainWatchEngine));if(!E)return;
  const $=id=>document.getElementById(id);

  async function loadCatalogs(){
    const catalogs={tx:[],keisei:[]};
    try{
      const response=await fetch('./data/timetable.json',{cache:'no-cache'});
      if(response.ok){const data=await response.json();catalogs.tx=(data.stations||[]).map((s,i)=>({id:s[0],name:s[1],en:s[2],i}));}
    }catch{}
    try{
      const response=await fetch('./data/keisei-main-stations.json',{cache:'no-cache'});
      if(response.ok){const data=await response.json();catalogs.keisei=(data.stations||[]).map((s,i)=>({id:s[0],name:s[1],en:s[2],i:s[3]??i}));}
    }catch{}
    if(!catalogs[ctx.rail].length)catalogs[ctx.rail]=E.STATIONS.map(s=>({id:s.id,name:s.name,en:s.en,i:s.i}));
    return catalogs;
  }
  const catalogs=await loadCatalogs();

  const railMeta={
    tx:{label:'TX',name:'つくばエクスプレス',scope:'20駅'},
    keisei:{label:'京成',name:'京成本線',scope:'42駅'}
  };
  const activeMeta=railMeta[ctx.rail];

  // The first view only confirms the current watching place. Choosing/changing
  // a rail is a low-frequency action and lives behind this one compact control.
  document.querySelector('.rail-switch')?.remove();
  const toolbar=document.querySelector('.station-toolbar');
  const stationButton=$('stationButton');
  const stationCode=$('stationCode');
  const stationName=$('stationName');
  const favorite=$('favoriteToggle');
  if(toolbar)toolbar.classList.add('location-context');
  if(stationButton){
    stationButton.classList.add('location-context-button');
    let railLabel=stationButton.querySelector('.location-rail-label');
    if(!railLabel){railLabel=document.createElement('span');railLabel.className='location-rail-label';stationButton.insertBefore(railLabel,stationButton.firstChild);}
    railLabel.textContent=activeMeta.label;
    const chevron=stationButton.querySelector('.chevron');if(chevron)chevron.textContent='⌄';
    const syncAria=()=>stationButton.setAttribute('aria-label',`見る場所を変更。現在は${activeMeta.name} ${stationCode?.textContent||''} ${stationName?.textContent||''}`);
    syncAria();
    if(stationCode)new MutationObserver(syncAria).observe(stationCode,{childList:true,characterData:true,subtree:true});
    if(stationName)new MutationObserver(syncAria).observe(stationName,{childList:true,characterData:true,subtree:true});
  }
  if(favorite){favorite.hidden=true;favorite.setAttribute('aria-hidden','true');favorite.tabIndex=-1;}
  document.querySelector('.favorites-section')?.setAttribute('hidden','');

  const brandSub=document.querySelector('.brand-lockup small');
  const footerLabel=document.querySelector('.app-footer p');
  const official=document.querySelector('.app-footer a');
  const dataLink=document.querySelector('.data-official-link');
  const trainFilter=$('trainFilter');
  const up=document.querySelector('#directionFilter [data-dir="up"]');
  const down=document.querySelector('#directionFilter [data-dir="down"]');

  if(ctx.rail==='keisei'){
    document.body.classList.add('keisei-app');
    if(brandSub){brandSub.textContent='京成・非公式';brandSub.setAttribute('aria-label','京成本線に対応した非公式ファンツール');}
    if(footerLabel)footerLabel.textContent='京成本線・非公式 β';
    if(official){official.href='https://www.keisei.co.jp/keisei/tetudou/railmap/';official.textContent='京成公式サイト ↗';}
    if(dataLink){dataLink.href='https://keisei.ekitan.com/naritaacs-i/timetable';dataLink.textContent='京成公式の時刻表を見る ↗';}
    if(up)up.textContent='上野・押上';if(down)down.textContent='成田・空港';
    if(trainFilter?.parentElement)trainFilter.parentElement.hidden=true;
    const dataCopy=$('dataVersionCopy')?.parentElement;
    if(dataCopy&&!dataCopy.querySelector('.keisei-data-note')){const p=document.createElement('p');p.className='keisei-data-note';p.textContent='京成は公式の駅発時刻を使用しています。通過列車と終着列車の到着は、現在のβ版では表示しません。';dataCopy.appendChild(p);}
    document.querySelector('#notifyDialog .notify-facts dd')?.replaceChildren(document.createTextNode('到着・発車'));
  }else{
    if(brandSub){brandSub.textContent='TX・非公式';brandSub.setAttribute('aria-label','つくばエクスプレスに対応した非公式ファンツール');}
    if(footerLabel)footerLabel.textContent='TX・非公式 β';
  }

  const stationDialog=$('stationDialog');
  const stationTitle=$('stationDialogTitle');
  const oldSearch=$('stationSearch');
  const oldSearchLabel=document.querySelector('label[for="stationSearch"]');
  const oldList=$('stationList');
  if(!stationDialog||!oldList)return;

  oldSearch?.setAttribute('hidden','');oldSearch?.setAttribute('aria-hidden','true');oldSearchLabel?.setAttribute('hidden','');oldList.setAttribute('hidden','');
  stationDialog.classList.add('location-dialog');
  if(stationTitle)stationTitle.textContent=ctx.needsLocationSetup?'どこで電車を見る？':'見る場所を変える';

  const picker=document.createElement('div');picker.className='location-picker';picker.innerHTML=`
    <p class="location-picker-lead">${ctx.needsLocationSetup?'いま電車が見える場所を選んでね。':'次に見たい場所を選びます。'}</p>
    <section class="recent-locations" aria-labelledby="recentLocationsTitle">
      <h3 id="recentLocationsTitle">最近見た場所</h3>
      <div class="recent-location-list"></div>
    </section>
    <div class="location-rail-tabs" role="tablist" aria-label="路線">
      <button type="button" role="tab" data-location-rail="tx"><strong>TX</strong><small>つくばエクスプレス</small></button>
      <button type="button" role="tab" data-location-rail="keisei"><strong>京成</strong><small>京成本線</small></button>
    </div>
    <label class="location-search-label" for="locationSearch">駅を探す</label>
    <input id="locationSearch" class="location-search" type="search" inputmode="search" autocomplete="off" placeholder="駅名・駅番号">
    <div class="location-list-heading"><strong id="locationListTitle"></strong><span id="locationListCount"></span></div>
    <div id="locationStationList" class="location-station-list"></div>`;
  oldList.insertAdjacentElement('beforebegin',picker);

  let pickerRail=ctx.rail;
  const locationSearch=$('locationSearch');
  const locationList=$('locationStationList');
  const listTitle=$('locationListTitle');
  const listCount=$('locationListCount');
  const recentSection=picker.querySelector('.recent-locations');
  const recentList=picker.querySelector('.recent-location-list');

  function stationInfo(rail,id){return catalogs[rail].find(s=>s.id===id);}
  function renderRecent(){
    const rows=['tx','keisei'].map(rail=>{const id=ctx.stationFor(rail),s=stationInfo(rail,id);return s?{rail,...s}:null;}).filter(Boolean);
    if(ctx.needsLocationSetup||!rows.length){recentSection.hidden=true;return;}
    recentSection.hidden=false;
    recentList.innerHTML=rows.map(x=>`<button type="button" class="recent-location" data-go-rail="${x.rail}" data-go-station="${x.id}"><span>${railMeta[x.rail].label}</span><strong>${x.name}</strong><small>${x.id}</small></button>`).join('');
  }

  function renderStations(){
    const meta=railMeta[pickerRail],q=(locationSearch.value||'').trim().toLowerCase();
    picker.querySelectorAll('[data-location-rail]').forEach(b=>{const active=b.dataset.locationRail===pickerRail;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
    listTitle.textContent=meta.name;listCount.textContent=meta.scope;
    const filtered=(catalogs[pickerRail]||[]).filter(s=>!q||s.name.toLowerCase().includes(q)||s.en.toLowerCase().includes(q)||s.id.toLowerCase().includes(q));
    locationList.innerHTML=filtered.length?filtered.map(s=>{
      const current=pickerRail===ctx.rail&&s.id===(stationCode?.textContent||ctx.defaultStation);
      return `<button type="button" class="location-station-choice" data-go-rail="${pickerRail}" data-go-station="${s.id}" aria-current="${current?'true':'false'}"><span class="location-code">${s.id}</span><span class="location-name"><strong>${s.name}</strong><small>${s.en}</small></span>${current?'<span class="location-current">いま</span>':''}</button>`;
    }).join(''):'<p class="location-empty">該当する駅がありません。</p>';
  }

  picker.addEventListener('click',e=>{
    const railButton=e.target.closest('[data-location-rail]');
    if(railButton){pickerRail=railButton.dataset.locationRail;locationSearch.value='';renderStations();locationSearch.focus({preventScroll:true});return;}
    const location=e.target.closest('[data-go-rail][data-go-station]');
    if(location){ctx.goToLocation(location.dataset.goRail,location.dataset.goStation);}
  });
  locationSearch.addEventListener('input',renderStations);
  renderRecent();renderStations();

  if(ctx.needsLocationSetup){
    stationDialog.classList.add('location-setup');
    const close=stationDialog.querySelector('.dialog-close');if(close)close.hidden=true;
    stationDialog.addEventListener('cancel',e=>e.preventDefault());
    stationDialog.addEventListener('click',e=>{if(e.target===stationDialog){e.preventDefault();e.stopImmediatePropagation();}},true);
    const controller=window.__trainWatchDialogs;
    const show=()=>setTimeout(()=>{if(!stationDialog.open)controller?.openDialog(stationDialog,null,null);},80);
    if(document.readyState==='complete')show();else window.addEventListener('load',show,{once:true});
  }

  if(stationCode){const remember=()=>ctx.rememberStation(stationCode.textContent.trim());remember();new MutationObserver(remember).observe(stationCode,{childList:true,characterData:true,subtree:true});}
})();