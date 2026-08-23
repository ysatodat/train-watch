(async()=>{
  'use strict';
  const ctx=window.RailContext;if(!ctx)return;
  const E=await(window.TrainWatchEngineReady||Promise.resolve(window.TrainWatchEngine));if(!E)return;
  const $=id=>document.getElementById(id);
  const toolbar=document.querySelector('.station-toolbar');
  if(toolbar&&!document.querySelector('.rail-switch')){
    const nav=document.createElement('nav');nav.className='rail-switch';nav.setAttribute('aria-label','見る路線');
    nav.innerHTML=`<button type="button" data-rail-switch="tx" aria-pressed="${ctx.rail==='tx'}">TX<small>つくばエクスプレス</small></button><button type="button" data-rail-switch="keisei" aria-pressed="${ctx.rail==='keisei'}">京成<small>京成本線</small></button>`;
    toolbar.before(nav);
    nav.addEventListener('click',e=>{const b=e.target.closest('[data-rail-switch]');if(!b)return;ctx.rememberStation($('stationCode')?.textContent.trim());ctx.switchRail(b.dataset.railSwitch);});
  }

  const brandSub=document.querySelector('.brand-lockup small');
  const footerLabel=document.querySelector('.app-footer p');
  const official=document.querySelector('.app-footer a');
  const dataLink=document.querySelector('.data-official-link');
  const title=$('stationDialogTitle');
  const search=$('stationSearch');
  const searchLabel=document.querySelector('label[for="stationSearch"]');
  const trainFilter=$('trainFilter');
  const up=document.querySelector('#directionFilter [data-dir="up"]');
  const down=document.querySelector('#directionFilter [data-dir="down"]');

  if(ctx.rail==='keisei'){
    document.body.classList.add('keisei-app');
    if(brandSub){brandSub.textContent='京成・非公式';brandSub.setAttribute('aria-label','京成本線に対応した非公式ファンツール');}
    if(footerLabel)footerLabel.textContent='京成本線・非公式 β';
    if(official){official.href='https://www.keisei.co.jp/keisei/tetudou/railmap/';official.textContent='京成公式サイト ↗';}
    if(dataLink){dataLink.href='https://keisei.ekitan.com/naritaacs-i/timetable';dataLink.textContent='京成公式の時刻表を見る ↗';}
    if(title)title.textContent='京成本線の駅をえらぶ';
    if(searchLabel)searchLabel.textContent='駅名・駅番号で検索';
    if(search)search.placeholder='例：京成船橋、KS22';
    if(up)up.textContent='上野・押上';if(down)down.textContent='成田・空港';
    if(trainFilter?.parentElement)trainFilter.parentElement.hidden=true;
    const shell=$('stationDialog')?.querySelector('.dialog-header');
    if(shell&&!document.querySelector('.rail-scope-note')){const p=document.createElement('p');p.className='rail-scope-note';p.textContent='京成は現在、京成本線42駅に対応しています。';shell.after(p);}
    const dataCopy=$('dataVersionCopy')?.parentElement;
    if(dataCopy&&!dataCopy.querySelector('.keisei-data-note')){const p=document.createElement('p');p.className='keisei-data-note';p.textContent='京成は公式の駅発時刻を使用しています。通過列車と終着列車の到着は、現在のβ版では表示しません。';dataCopy.appendChild(p);}
    document.querySelector('#notifyDialog .notify-facts dd')?.replaceChildren(document.createTextNode('到着・発車'));
  }else{
    if(brandSub){brandSub.textContent='TX・非公式';brandSub.setAttribute('aria-label','つくばエクスプレスに対応した非公式ファンツール');}
    if(footerLabel)footerLabel.textContent='TX・非公式 β';
  }

  const code=$('stationCode');
  if(code){const remember=()=>ctx.rememberStation(code.textContent.trim());remember();new MutationObserver(remember).observe(code,{childList:true,characterData:true,subtree:true});}
})();
