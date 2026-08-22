(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = () => typeof window.gsap !== 'undefined';
  const $ = s => document.querySelector(s);

  function initialReveal() {
    if (reduceMotion || !hasGSAP()) return;
    const g = window.gsap;
    const heroAction = document.querySelector('#heroMomentAction:not([hidden])');
    const timeline = g.timeline({ defaults:{ ease:'power2.out' } })
      .from('.app-header', { y:-6, opacity:0, duration:.24 })
      .from('.station-toolbar', { y:6, opacity:0, duration:.22 }, '-=.10')
      .from('.hero-card', { y:9, opacity:0, duration:.30 }, '-=.06')
      .from('.hero-card .countdown, .hero-card .hero-message', { y:4, opacity:0, duration:.22, stagger:.045 }, '-=.16')
      .from('.train-wrap', { x:-14, opacity:0, duration:.30, ease:'power3.out', clearProps:'transform,opacity' }, '-=.14');
    if (heroAction) timeline.from(heroAction,{y:4,opacity:0,duration:.18},'-=.08');
    timeline
      .from('.quick-tools', { opacity:0, duration:.18 }, '-=.04')
      .from('.moments-section,.favorites-section,.timeline-section', { y:6, opacity:0, duration:.20, stagger:.05 }, '-=.03');
  }

  function pressIn(el) {
    if (!el || reduceMotion || !hasGSAP()) return;
    window.gsap.to(el, { scale:.985, duration:.07, ease:'power1.out', overwrite:true });
  }

  function pressOut(el) {
    if (!el || reduceMotion || !hasGSAP()) return;
    window.gsap.to(el, { scale:1, duration:.13, ease:'power2.out', overwrite:true, clearProps:'transform' });
  }

  function bindPressFeedback() {
    const selector = '.touchable,.favorite-card,.station-select,.star-btn,.settings-link,.data-notice button,.segmented button,.toggle-row';
    document.addEventListener('pointerdown', e => {
      const el=e.target.closest?.(selector);
      if (el && !el.disabled) pressIn(el);
    }, { passive:true });
    ['pointerup','pointercancel','pointerleave'].forEach(type => {
      document.addEventListener(type, e => {
        const el=e.target.closest?.(selector);
        if (el) pressOut(el);
      }, { passive:true });
    });
  }

  function favoriteMoment() {
    const star=$('#favoriteToggle');
    if (!star || reduceMotion || !hasGSAP()) return;
    window.gsap.fromTo(star,{ rotation:-3, scale:.94 },{ rotation:0, scale:1, duration:.24, ease:'power3.out', clearProps:'transform' });
  }

  function heroRefresh() {
    if (reduceMotion || !hasGSAP()) return;
    const g=window.gsap;
    g.fromTo('#countdown', { y:3, opacity:.74 }, { y:0, opacity:1, duration:.19, ease:'power2.out', clearProps:'transform,opacity' });
    g.fromTo('#trainWrap', { x:-10, opacity:.62 }, { x:0, opacity:1, duration:.27, ease:'power3.out', clearProps:'transform,opacity' });
  }

  function observeHeroAction() {
    const action=$('#heroMomentAction');
    if (!action) return;
    new MutationObserver(() => {
      if (!action.hidden && !reduceMotion && hasGSAP()) {
        window.gsap.fromTo(action,{y:5,opacity:0},{y:0,opacity:1,duration:.20,ease:'power2.out',clearProps:'transform,opacity'});
      }
    }).observe(action,{attributes:true,attributeFilter:['hidden']});
  }

  function observeToast() {
    const toast=$('#toast');
    if (!toast) return;
    new MutationObserver(() => {
      if (!toast.hidden && !reduceMotion && hasGSAP()) {
        window.gsap.fromTo(toast,{ y:8, opacity:0 },{ y:0, opacity:1, duration:.20, ease:'power2.out', clearProps:'transform,opacity' });
      }
    }).observe(toast, { attributes:true, attributeFilter:['hidden'] });
  }

  function observeTenCount() {
    const ten=$('#tenCount');
    if (!ten) return;
    let last='';
    new MutationObserver(() => {
      if (!ten.hidden && ten.textContent && ten.textContent !== last) {
        last=ten.textContent;
        if (!reduceMotion && hasGSAP()) {
          window.gsap.fromTo('#countdown', { scale:1.015 }, { scale:1, duration:.18, ease:'power2.out', clearProps:'transform' });
        }
      }
    }).observe(ten, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden'] });
  }

  function bindMoments() {
    document.addEventListener('click', e => {
      if (e.target.closest('#favoriteToggle')) setTimeout(favoriteMoment,0);
      if (e.target.closest('.favorite-card') || e.target.closest('.station-select')) setTimeout(heroRefresh,35);
      if (e.target.closest('#notifyButton') && !reduceMotion && hasGSAP()) {
        window.gsap.fromTo('#notifyButton', { opacity:.72 }, { opacity:1, duration:.18, ease:'power2.out', clearProps:'opacity' });
      }
    });
  }

  function init() {
    bindPressFeedback();
    bindMoments();
    observeHeroAction();
    observeToast();
    observeTenCount();
    if (document.readyState === 'complete') initialReveal();
    else window.addEventListener('load', initialReveal, { once:true });
  }

  init();
})();
