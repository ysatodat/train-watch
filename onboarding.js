(() => {
  'use strict';
  const KEY='denshaKuruyoIntroV1';

  async function init(){
    try { await (window.TrainWatchEngineReady || Promise.resolve()); } catch {}
    const dialog=document.getElementById('aboutDialog');
    const controller=window.__trainWatchDialogs;
    if(!dialog||!controller)return;

    dialog.addEventListener('close',()=>{
      try{localStorage.setItem(KEY,'seen');}catch{}
    });

    let seen=false;
    try{seen=localStorage.getItem(KEY)==='seen';}catch{}
    if(seen)return;

    window.addEventListener('load',()=>{
      setTimeout(()=>{
        if(!dialog.open&&!document.querySelector('dialog[open]')){
          controller.openDialog(dialog,null,null);
        }
      },420);
    },{once:true});
  }

  init();
})();
