(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animateOpen(dialog) {
    if (prefersReducedMotion || !window.gsap || !dialog) return;
    const shell = dialog.querySelector('.dialog-shell');
    if (!shell) return;
    window.gsap.fromTo(shell,
      { y: 18, opacity: 0, scale: .985 },
      { y: 0, opacity: 1, scale: 1, duration: .28, ease: 'power3.out', clearProps: 'transform,opacity' }
    );
  }

  function openDialog(dialog, focusTarget) {
    if (!dialog) return;
    try {
      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal();
      } else {
        dialog.classList.add('fallback-open');
        dialog.setAttribute('open', '');
      }
    } catch {
      dialog.classList.add('fallback-open');
      dialog.setAttribute('open', '');
    }
    animateOpen(dialog);
    if (focusTarget) setTimeout(() => focusTarget.focus({ preventScroll: true }), 120);
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (!prefersReducedMotion && window.gsap) {
      const shell = dialog.querySelector('.dialog-shell');
      if (shell) {
        window.gsap.to(shell, {
          y: 10, opacity: 0, scale: .99, duration: .16, ease: 'power2.in',
          onComplete: () => finishClose(dialog), clearProps: 'transform,opacity'
        });
        return;
      }
    }
    finishClose(dialog);
  }

  function finishClose(dialog) {
    try {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
    } catch {
      dialog.removeAttribute('open');
    }
    dialog.classList.remove('fallback-open');
  }

  function byId(id) { return document.getElementById(id); }

  /* Capture phaseで既存app.jsより先にshowModal()する。
     これによりapp.js側のsetAttribute('open')が後から走っても安全。 */
  document.addEventListener('click', event => {
    const target = event.target;

    if (target.closest('#stationButton') || target.closest('#openStations')) {
      openDialog(byId('stationDialog'), byId('stationSearch'));
      return;
    }
    if (target.closest('#openSettings')) {
      openDialog(byId('settingsDialog'));
      return;
    }
    if (target.closest('#openDataInfo')) {
      openDialog(byId('dataDialog'));
      return;
    }

    const closeButton = target.closest('[data-close-dialog]');
    if (closeButton) {
      event.preventDefault();
      closeDialog(byId(closeButton.dataset.closeDialog));
    }
  }, true);

  document.querySelectorAll('.native-dialog').forEach(dialog => {
    /* backdrop tap */
    dialog.addEventListener('click', event => {
      if (event.target === dialog) closeDialog(dialog);
    });

    /* station selection: app.jsの処理後に確実にclose() */
    if (dialog.id === 'stationDialog') {
      dialog.addEventListener('click', event => {
        if (event.target.closest('.station-select')) {
          setTimeout(() => finishClose(dialog), 0);
        }
      });
    }
  });
})();