(() => {
  'use strict';

  /* Native dialog styles are loaded here so the existing Pages entrypoint stays cache-safe. */
  if (!document.querySelector('link[href="./native-ui.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './native-ui.css';
    document.head.appendChild(link);
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = () => typeof window.gsap !== 'undefined';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  function finishClose(dialog) {
    if (!dialog) return;
    try {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
    } catch { dialog.removeAttribute('open'); }
    dialog.classList.remove('fallback-open');
  }

  function openDialog(dialog, focusTarget) {
    if (!dialog) return;
    try {
      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal();
      } else {
        dialog.classList.add('fallback-open');
        dialog.setAttribute('open','');
      }
    } catch {
      dialog.classList.add('fallback-open');
      dialog.setAttribute('open','');
    }

    const shell = dialog.querySelector('.dialog-shell');
    if (!reduceMotion && hasGSAP() && shell) {
      window.gsap.fromTo(shell,
        { y:18, opacity:0, scale:.985 },
        { y:0, opacity:1, scale:1, duration:.28, ease:'power3.out', clearProps:'transform,opacity' }
      );
    }
    if (focusTarget) setTimeout(() => focusTarget.focus({preventScroll:true}), 120);
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    const shell = dialog.querySelector('.dialog-shell');
    if (!reduceMotion && hasGSAP() && shell) {
      window.gsap.to(shell, {
        y:10, opacity:0, scale:.99, duration:.15, ease:'power2.in',
        onComplete:() => finishClose(dialog), clearProps:'transform,opacity'
      });
    } else finishClose(dialog);
  }

  /* Capture phase is intentional: app.js still contains its older open-attribute handler.
     showModal() must run first on native <dialog> to avoid Safari's non-modal state. */
  document.addEventListener('click', event => {
    const target = event.target;
    if (target.closest('#stationButton') || target.closest('#openStations')) {
      openDialog($('#stationDialog'), $('#stationSearch'));
      return;
    }
    if (target.closest('#openSettings')) {
      openDialog($('#settingsDialog'));
      return;
    }
    if (target.closest('#openDataInfo')) {
      openDialog($('#dataDialog'));
      return;
    }
    const closer = target.closest('[data-close-dialog]');
    if (closer) {
      event.preventDefault();
      closeDialog(document.getElementById(closer.dataset.closeDialog));
    }
  }, true);

  function bindNativeDialogs() {
    $$('.native-dialog').forEach(dialog => {
      dialog.addEventListener('click', event => {
        if (event.target === dialog) closeDialog(dialog);
        if (dialog.id === 'stationDialog' && event.target.closest('.station-select')) {
          setTimeout(() => finishClose(dialog), 0);
        }
      });
    });
  }

  function initialReveal() {
    if (reduceMotion || !hasGSAP()) return;
    const g = window.gsap;
    g.timeline({defaults:{ease:'power3.out'}})
      .from('.app-header',{y:-10,opacity:0,duration:.35})
      .from('.station-toolbar',{y:10,opacity:0,duration:.32},'-=.16')
      .from('.hero-card',{y:18,opacity:0,scale:.988,duration:.46},'-=.14')
      .from('.hero-card .countdown,.hero-card .hero-message',{y:8,opacity:0,duration:.3,stagger:.07},'-=.26')
      .from('.train-wrap',{x:-28,opacity:0,duration:.45,ease:'back.out(1.35)',clearProps:'transform'},'-=.22')
      .from('.hero-actions > *',{y:8,opacity:0,duration:.28,stagger:.06},'-=.18')
      .from('.favorites-section,.timeline-section',{y:12,opacity:0,duration:.3,stagger:.07},'-=.05');
  }

  function pressIn(el) {
    if (!el || reduceMotion || !hasGSAP()) return;
    window.gsap.to(el,{scale:.965,duration:.08,ease:'power2.out',overwrite:true});
  }
  function pressOut(el) {
    if (!el || reduceMotion || !hasGSAP()) return;
    window.gsap.to(el,{scale:1,duration:.2,ease:'back.out(2)',overwrite:true,clearProps:'transform'});
  }

  function bindPressFeedback() {
    const selector = '.touchable,.favorite-card,.station-select,.star-btn,.settings-link,.data-notice button,.segmented button,.toggle-row';
    document.addEventListener('pointerdown',e=>{
      const el=e.target.closest?.(selector); if(el&&!el.disabled) pressIn(el);
    },{passive:true});
    ['pointerup','pointercancel','pointerleave'].forEach(type=>document.addEventListener(type,e=>{
      const el=e.target.closest?.(selector); if(el) pressOut(el);
    },{passive:true}));
  }

  function favoritePop() {
    const star=$('#favoriteToggle');
    if (!star || reduceMotion || !hasGSAP()) return;
    window.gsap.fromTo(star,{rotation:-10,scale:.78},{rotation:0,scale:1,duration:.42,ease:'elastic.out(1,.5)',clearProps:'transform'});
  }

  function heroRefresh() {
    if (reduceMotion || !hasGSAP()) return;
    const g=window.gsap;
    g.fromTo('#countdown',{y:5,opacity:.68},{y:0,opacity:1,duration:.25,ease:'power2.out'});
    g.fromTo('#trainWrap',{x:-20,opacity:.45},{x:0,opacity:1,duration:.42,ease:'back.out(1.4)',clearProps:'transform,opacity'});
  }

  function observeToastAndCountdown() {
    const toast=$('#toast');
    if (toast) new MutationObserver(()=>{
      if(!toast.hidden&&!reduceMotion&&hasGSAP()) window.gsap.fromTo(toast,{y:16,opacity:0,scale:.97},{y:0,opacity:1,scale:1,duration:.3,ease:'back.out(1.7)',clearProps:'transform,opacity'});
    }).observe(toast,{attributes:true,attributeFilter:['hidden']});

    const ten=$('#tenCount');
    if(ten) {
      let last='';
      new MutationObserver(()=>{
        if(!ten.hidden&&ten.textContent&&ten.textContent!==last){
          last=ten.textContent;
          if(!reduceMotion&&hasGSAP()) {
            window.gsap.fromTo('#countdown',{scale:1.035},{scale:1,duration:.25,ease:'back.out(2)',clearProps:'transform'});
            window.gsap.fromTo(ten,{scale:.92},{scale:1,duration:.28,ease:'back.out(2)',clearProps:'transform'});
          }
        }
      }).observe(ten,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
    }
  }

  function bindMoments() {
    document.addEventListener('click',e=>{
      if(e.target.closest('#favoriteToggle')) setTimeout(favoritePop,0);
      if(e.target.closest('.favorite-card')||e.target.closest('.station-select')) setTimeout(heroRefresh,35);
      if(e.target.closest('#notifyButton')&&!reduceMotion&&hasGSAP()) window.gsap.fromTo('#notifyButton',{scale:.96},{scale:1,duration:.3,ease:'back.out(2)',clearProps:'transform'});
      if(e.target.closest('#shareButton .action-icon')&&!reduceMotion&&hasGSAP()) window.gsap.fromTo('#shareButton .action-icon',{y:0,rotation:0},{y:-5,rotation:-7,duration:.17,yoyo:true,repeat:1,ease:'power2.out',clearProps:'transform'});
    });
  }

  function init() {
    bindNativeDialogs();
    bindPressFeedback();
    bindMoments();
    observeToastAndCountdown();
    if(document.readyState==='complete') initialReveal();
    else window.addEventListener('load',initialReveal,{once:true});
  }

  init();
})();