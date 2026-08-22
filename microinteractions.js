(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = () => typeof window.gsap !== 'undefined';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  function tween(target, vars) {
    if (reduceMotion || !hasGSAP() || !target) return;
    window.gsap.to(target, vars);
  }

  function initialReveal() {
    if (reduceMotion || !hasGSAP()) return;
    const gsap = window.gsap;
    const tl = gsap.timeline({ defaults:{ ease:'power3.out' } });
    tl.from('.app-header', { y:-12, opacity:0, duration:.42 })
      .from('.station-toolbar', { y:12, opacity:0, duration:.38 }, '-=.22')
      .from('.data-notice', { y:8, opacity:0, duration:.30 }, '-=.22')
      .from('.hero-card', { y:20, opacity:0, scale:.985, duration:.52 }, '-=.18')
      .from('.hero-card .hero-topline, .hero-card .countdown, .hero-card .hero-message', {
        y:10, opacity:0, duration:.34, stagger:.07
      }, '-=.32')
      .from('.train-wrap', { x:-36, opacity:0, duration:.52, ease:'back.out(1.35)', clearProps:'transform' }, '-=.28')
      .from('.hero-actions > *', { y:10, opacity:0, duration:.32, stagger:.07 }, '-=.22')
      .from('.favorites-section, .timeline-section', { y:16, opacity:0, duration:.36, stagger:.08 }, '-=.08');
  }

  function pressIn(el) {
    if (!el || reduceMotion || !hasGSAP()) return;
    el.classList.add('is-pressing');
    window.gsap.to(el, { scale:.965, duration:.09, ease:'power2.out', overwrite:true });
  }
  function pressOut(el) {
    if (!el || reduceMotion || !hasGSAP()) return;
    window.gsap.to(el, {
      scale:1, duration:.22, ease:'back.out(2)', overwrite:true,
      onComplete:()=>el.classList.remove('is-pressing')
    });
  }

  function bindPressFeedback() {
    const selector = [
      '.touchable', '.favorite-card', '.station-select', '.star-btn',
      '.settings-link', '.data-notice button', '.segmented button'
    ].join(',');

    document.addEventListener('pointerdown', e => {
      const el = e.target.closest?.(selector);
      if (el && !el.disabled) pressIn(el);
    }, { passive:true });

    ['pointerup','pointercancel','pointerleave'].forEach(type => {
      document.addEventListener(type, e => {
        const el = e.target.closest?.(selector);
        if (el) pressOut(el);
      }, { passive:true });
    });
  }

  function sparkAround(el) {
    if (reduceMotion || !hasGSAP() || !el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;
    const gsap = window.gsap;
    const particles = [];

    for (let i=0;i<7;i++) {
      const p=document.createElement('span');
      p.className='motion-spark';
      p.style.left=`${cx-3.5}px`;
      p.style.top=`${cy-3.5}px`;
      if (i%2) p.style.background='var(--brand-blue)';
      document.body.appendChild(p);
      particles.push(p);
      const a=(Math.PI*2*i/7)-Math.PI/2;
      const d=25+(i%3)*6;
      gsap.to(p, {
        x:Math.cos(a)*d,
        y:Math.sin(a)*d,
        scale:0,
        opacity:0,
        duration:.48,
        ease:'power2.out',
        onComplete:()=>p.remove()
      });
    }
  }

  function heroRefresh() {
    if (reduceMotion || !hasGSAP()) return;
    const gsap=window.gsap;
    gsap.fromTo('#hero', { scale:.988 }, { scale:1, duration:.34, ease:'back.out(1.5)', clearProps:'transform' });
    gsap.fromTo('#countdown', { y:5, opacity:.66 }, { y:0, opacity:1, duration:.28, ease:'power2.out' });
    gsap.fromTo('#trainWrap', { x:-24, opacity:.4 }, { x:0, opacity:1, duration:.5, ease:'back.out(1.4)', clearProps:'transform' });
    gsap.from('.hero-meta .pill', { y:6, opacity:0, duration:.25, stagger:.035, ease:'power2.out' });
  }

  function favoritePop() {
    const star=$('#favoriteToggle');
    if (!star || reduceMotion || !hasGSAP()) return;
    const gsap=window.gsap;
    gsap.fromTo(star, { rotation:-12, scale:.76 }, { rotation:0, scale:1, duration:.44, ease:'elastic.out(1,.48)', clearProps:'transform' });
    if (star.classList.contains('on')) sparkAround(star);
  }

  function alertPop() {
    if (reduceMotion || !hasGSAP()) return;
    const gsap=window.gsap;
    gsap.fromTo('#notifyButton', { scale:.96 }, { scale:1, duration:.35, ease:'back.out(2)', clearProps:'transform' });
    gsap.fromTo('#hero', { boxShadow:'0 14px 38px rgba(32,73,118,.12)' }, {
      boxShadow:'0 18px 48px rgba(56,184,120,.22)', duration:.22, yoyo:true, repeat:1, ease:'power2.inOut', clearProps:'boxShadow'
    });
  }

  function sharePop() {
    if (reduceMotion || !hasGSAP()) return;
    const icon=$('#shareButton .action-icon');
    if (!icon) return;
    window.gsap.fromTo(icon, { y:0, rotation:0 }, { y:-5, rotation:-8, duration:.18, yoyo:true, repeat:1, ease:'power2.out', clearProps:'transform' });
  }

  function revealDialogRows() {
    if (reduceMotion || !hasGSAP()) return;
    requestAnimationFrame(()=>setTimeout(()=>{
      const rows=$$('.station-row:not([hidden])');
      if (!rows.length) return;
      window.gsap.fromTo(rows, { x:-8, opacity:0 }, { x:0, opacity:1, duration:.26, stagger:.025, ease:'power2.out', clearProps:'transform,opacity' });
    },90));
  }

  function countdownPulse() {
    if (reduceMotion || !hasGSAP()) return;
    const c=$('#countdown');
    const t=$('#tenCount');
    window.gsap.fromTo(c, { scale:1.035 }, { scale:1, duration:.28, ease:'back.out(2)', clearProps:'transform' });
    if (t && !t.hidden) window.gsap.fromTo(t, { scale:.92, y:2 }, { scale:1, y:0, duration:.3, ease:'back.out(2)', clearProps:'transform' });
  }

  function observeCountdown() {
    const t=$('#tenCount');
    if (!t) return;
    let last='';
    const mo=new MutationObserver(()=>{
      const value=t.textContent;
      if (!t.hidden && value && value!==last) {
        last=value;
        countdownPulse();
      }
    });
    mo.observe(t,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  }

  function observeToast() {
    const toast=$('#toast');
    if (!toast) return;
    const mo=new MutationObserver(()=>{
      if (!toast.hidden && !reduceMotion && hasGSAP()) {
        window.gsap.fromTo(toast, { y:18, opacity:0, scale:.97 }, { y:0, opacity:1, scale:1, duration:.34, ease:'back.out(1.7)', clearProps:'transform,opacity' });
      }
    });
    mo.observe(toast,{attributes:true,attributeFilter:['hidden']});
  }

  function bindInteractionMoments() {
    document.addEventListener('click', e => {
      const target=e.target;
      if (target.closest('#favoriteToggle')) setTimeout(favoritePop,0);
      if (target.closest('#stationButton') || target.closest('#openStations')) revealDialogRows();
      if (target.closest('.favorite-card') || target.closest('.station-select')) setTimeout(heroRefresh,40);
      if (target.closest('#notifyButton')) setTimeout(alertPop,0);
      if (target.closest('#shareButton')) sharePop();
      if (target.closest('.segmented button')) {
        const b=target.closest('.segmented button');
        if (!reduceMotion && hasGSAP()) window.gsap.fromTo(b,{scale:.96},{scale:1,duration:.25,ease:'back.out(2)',clearProps:'transform'});
      }
    });
  }

  function init() {
    bindPressFeedback();
    bindInteractionMoments();
    observeCountdown();
    observeToast();
    if (document.readyState==='complete') initialReveal();
    else window.addEventListener('load',initialReveal,{once:true});
  }

  init();
})();
