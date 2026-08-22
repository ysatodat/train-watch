(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = () => typeof window.gsap !== 'undefined';
  const $ = s => document.querySelector(s);

  function initialReveal() {
    if (reduceMotion || !hasGSAP()) return;
    const g = window.gsap;
    g.timeline({ defaults:{ ease:'power2.out' } })
      .from('.app-header', { y:-6, opacity:0, duration:.26 })
      .from('.station-toolbar', { y:7, opacity:0, duration:.24 }, '-=.12')
      .from('.data-notice', { opacity:0, duration:.18 }, '-=.12')
      .from('.hero-card', { y:10, opacity:0, duration:.32 }, '-=.08')
      .from('.hero-card .countdown, .hero-card .hero-message', { y:5, opacity:0, duration:.24, stagger:.05 }, '-=.18')
      .from('.train-wrap', { x:-18, opacity:0, duration:.34, ease:'power3.out', clearProps:'transform,opacity' }, '-=.16')
      .from('.hero-actions > *', { y:5, opacity:0, duration:.2, stagger:.045 }, '-=.10')
      .from('.favorites-section,.timeline-section', { y:7, opacity:0, duration:.22, stagger:.06 }, '-=.04');
  }

  function pressIn(el) {
    if (!el || reduceMotion || !hasGSAP()) return;
    window.gsap.to(el, { scale:.985, duration:.07, ease:'power1.out', overwrite:true });
  }

  function pressOut(el) {
    if (!el || reduceMotion || !hasGSAP()) return;
    window.gsap.to(el, { scale:1, duration:.14, ease:'power2.out', overwrite:true, clearProps:'transform' });
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
    window.gsap.fromTo(star,
      { rotation:-4, scale:.92 },
      { rotation:0, scale:1, duration:.28, ease:'power3.out', clearProps:'transform' }
    );
  }

  function heroRefresh() {
    if (reduceMotion || !hasGSAP()) return;
    const g=window.gsap;
    g.fromTo('#countdown', { y:3, opacity:.72 }, { y:0, opacity:1, duration:.2, ease:'power2.out', clearProps:'transform,opacity' });
    g.fromTo('#trainWrap', { x:-12, opacity:.58 }, { x:0, opacity:1, duration:.3, ease:'power3.out', clearProps:'transform,opacity' });
  }

  function observeToast() {
    const toast=$('#toast');
    if (!toast) return;
    new MutationObserver(() => {
      if (!toast.hidden && !reduceMotion && hasGSAP()) {
        window.gsap.fromTo(toast,
          { y:10, opacity:0 },
          { y:0, opacity:1, duration:.22, ease:'power2.out', clearProps:'transform,opacity' }
        );
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
          window.gsap.fromTo('#countdown', { scale:1.018 }, { scale:1, duration:.2, ease:'power2.out', clearProps:'transform' });
          window.gsap.fromTo(ten, { y:2, opacity:.82 }, { y:0, opacity:1, duration:.18, ease:'power2.out', clearProps:'transform,opacity' });
        }
      }
    }).observe(ten, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden'] });
  }

  function bindMoments() {
    document.addEventListener('click', e => {
      if (e.target.closest('#favoriteToggle')) setTimeout(favoriteMoment,0);
      if (e.target.closest('.favorite-card') || e.target.closest('.station-select')) setTimeout(heroRefresh,35);
      if (e.target.closest('#notifyButton') && !reduceMotion && hasGSAP()) {
        window.gsap.fromTo('#notifyButton', { opacity:.78 }, { opacity:1, duration:.2, ease:'power2.out', clearProps:'opacity' });
      }
    });
  }

  function init() {
    bindPressFeedback();
    bindMoments();
    observeToast();
    observeTenCount();
    if (document.readyState === 'complete') initialReveal();
    else window.addEventListener('load', initialReveal, { once:true });
  }

  init();
})();