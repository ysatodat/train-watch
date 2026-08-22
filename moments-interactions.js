(() => {
  'use strict';

  if (!document.querySelector('link[href="./overnight.css"]')) {
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='./overnight.css';
    document.head.appendChild(link);
  }

  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP=()=>typeof window.gsap!=='undefined';
  const train=()=>document.getElementById('trainWrap');
  const hero=()=>document.getElementById('hero');
  let lastKey='';

  function directionSign(){return hero()?.dataset.dir==='up'?-1:1;}
  function resetTrain(){
    const t=train();if(!t||!hasGSAP())return;
    window.gsap.killTweensOf(t);
    window.gsap.set(t,{clearProps:'transform,opacity'});
  }
  function arrivalMoment(){
    const t=train();if(!t||reduceMotion||!hasGSAP())return;
    const d=directionSign();
    window.gsap.killTweensOf(t);
    window.gsap.fromTo(t,{x:-26*d,opacity:.55},{x:0,opacity:1,duration:.55,ease:'power3.out',clearProps:'transform,opacity'});
  }
  function departureMoment(){
    const t=train();if(!t||reduceMotion||!hasGSAP())return;
    const d=directionSign();
    window.gsap.killTweensOf(t);
    window.gsap.fromTo(t,{x:0},{x:5*d,duration:.32,ease:'power1.inOut',yoyo:true,repeat:1,clearProps:'transform'});
  }
  function passMoment(){
    const t=train();if(!t||reduceMotion||!hasGSAP())return;
    const d=directionSign();
    window.gsap.killTweensOf(t);
    window.gsap.fromTo(t,{x:-170*d,opacity:.25},{x:210*d,opacity:1,duration:.72,ease:'power2.in',clearProps:'transform,opacity'});
  }
  function observedDeparture(){
    const t=train();if(!t||reduceMotion||!hasGSAP())return;
    const d=directionSign();
    window.gsap.killTweensOf(t);
    window.gsap.to(t,{x:240*d,opacity:.15,duration:1.05,ease:'power2.in',onComplete:resetTrain});
  }
  function pulseCard(visitId){
    if(reduceMotion||!hasGSAP()||!visitId)return;
    const card=document.querySelector(`.moment-card[data-visit="${CSS.escape(visitId)}"]`);
    if(!card)return;
    window.gsap.fromTo(card,{scale:.99},{scale:1,duration:.28,ease:'power2.out',clearProps:'transform'});
  }

  window.addEventListener('trainwatch:momentchange',event=>{
    const focus=event.detail?.focus;
    if(!focus)return;
    const key=`${focus.key}:${focus.status}`;
    if(key===lastKey)return;
    lastKey=key;
    if(focus.status!=='active'){resetTrain();return;}
    if(focus.type==='arrival')arrivalMoment();
    else if(focus.type==='departure')departureMoment();
    else if(focus.type==='pass')passMoment();
  });

  window.addEventListener('trainwatch:observed',event=>{
    const action=event.detail?.action;
    const visitId=event.detail?.visitId;
    pulseCard(visitId);
    if(action==='departed')observedDeparture();
    if(action==='seen')passMoment();
  });
})();