(() => {
  'use strict';
  const KEY='denshaKuruyoIntroV2';
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rail=window.RailContext?.rail||'tx';

  function ensureStyles(){
    if(!document.querySelector('link[data-product-v5]')){
      const link=document.createElement('link');link.rel='stylesheet';link.href='./product-v5.css';link.dataset.productV5='1';document.head.appendChild(link);
    }
    if(rail==='tx'&&!document.querySelector('link[data-tx-special]')){
      const link=document.createElement('link');link.rel='stylesheet';link.href='./tx-special.css';link.dataset.txSpecial='1';document.head.appendChild(link);
    }
  }
  function ensureTxSpecialScript(){
    if(rail!=='tx'||document.querySelector('script[data-tx-special]'))return;
    const script=document.createElement('script');script.src='./tx-special.js';script.async=false;script.dataset.txSpecial='1';document.head.appendChild(script);
  }
  function ensureRailSwitchScript(){
    if(document.querySelector('script[data-rail-switch]'))return;
    const script=document.createElement('script');script.src='./rail-switch.js';script.async=false;script.dataset.railSwitch='1';document.head.appendChild(script);
  }

  ensureStyles();ensureTxSpecialScript();ensureRailSwitchScript();

  async function init(){
    try { await (window.TrainWatchEngineReady || Promise.resolve()); } catch {}
    const dialog=document.getElementById('aboutDialog');
    const controller=window.__trainWatchDialogs;
    const slides=[...document.querySelectorAll('[data-tutorial-step]')];
    const dots=[...document.querySelectorAll('.tutorial-progress i')];
    const back=document.getElementById('tutorialBack');
    const next=document.getElementById('tutorialNext');
    const done=document.getElementById('tutorialDone');
    if(!dialog||!controller||slides.length!==3||!back||!next||!done)return;

    let step=0;
    function render(nextStep,{animate=true,direction=1}={}){
      step=Math.max(0,Math.min(slides.length-1,nextStep));
      slides.forEach((slide,i)=>{const active=i===step;slide.hidden=!active;slide.classList.toggle('is-active',active);slide.setAttribute('aria-hidden',String(!active));});
      dots.forEach((dot,i)=>dot.classList.toggle('is-active',i===step));
      back.hidden=step===0;next.hidden=step===slides.length-1;done.hidden=step!==slides.length-1;
      const active=slides[step];
      if(animate&&!reduceMotion&&window.gsap&&active){
        window.gsap.fromTo(active,{x:direction*12,opacity:.2},{x:0,opacity:1,duration:.24,ease:'power2.out',clearProps:'transform,opacity'});
        const art=active.querySelector('.tutorial-art');if(art)window.gsap.fromTo(art,{y:4,scale:.99},{y:0,scale:1,duration:.3,ease:'power2.out',clearProps:'transform'});
      }
    }
    function reset(){render(0,{animate:false});}
    next.addEventListener('click',()=>render(step+1,{direction:1}));back.addEventListener('click',()=>render(step-1,{direction:-1}));
    dialog.addEventListener('close',()=>{try{localStorage.setItem(KEY,'seen');}catch{}});
    document.addEventListener('click',e=>{if(e.target.closest?.('#openAbout,#openAboutFooter'))setTimeout(reset,0);});
    reset();let seen=false;try{seen=localStorage.getItem(KEY)==='seen';}catch{}if(seen)return;
    const show=()=>setTimeout(()=>{const otherOpen=[...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog);if(!dialog.open&&!otherOpen){reset();controller.openDialog(dialog,null,null);}},420);
    if(document.readyState==='complete')show();else window.addEventListener('load',show,{once:true});
  }
  init();
})();
