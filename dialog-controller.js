(() => {
  'use strict';

  const DIALOG_IDS = ['stationDialog', 'settingsDialog', 'dataDialog'];
  const dialogs = () => DIALOG_IDS.map(id => document.getElementById(id)).filter(Boolean);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastTrigger = null;
  let previousBodyOverflow = '';

  function animateOpen(dialog) {
    if (reduceMotion || !window.gsap) return;
    const shell = dialog.querySelector('.dialog-shell');
    if (!shell) return;
    window.gsap.killTweensOf(shell);
    window.gsap.fromTo(
      shell,
      { y: 14, opacity: 0, scale: 0.985 },
      { y: 0, opacity: 1, scale: 1, duration: 0.26, ease: 'power3.out', clearProps: 'transform,opacity' }
    );
  }

  function lockPage() {
    if (document.body.dataset.dialogLocked === '1') return;
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.dataset.dialogLocked = '1';
  }

  function unlockPageIfDone() {
    if (dialogs().some(dialog => dialog.open || dialog.classList.contains('fallback-open'))) return;
    document.body.style.overflow = previousBodyOverflow;
    delete document.body.dataset.dialogLocked;
  }

  function closeNow(dialog, { restoreFocus = true } = {}) {
    if (!dialog) return;

    const wasOpen = dialog.open || dialog.hasAttribute('open') || dialog.classList.contains('fallback-open');
    if (!wasOpen) return;

    try {
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    } catch {
      dialog.removeAttribute('open');
    }

    dialog.classList.remove('fallback-open');
    const shell = dialog.querySelector('.dialog-shell');
    if (shell && window.gsap) window.gsap.set(shell, { clearProps: 'transform,opacity' });
    unlockPageIfDone();

    if (restoreFocus && lastTrigger && document.contains(lastTrigger)) {
      requestAnimationFrame(() => {
        try { lastTrigger.focus({ preventScroll: true }); } catch {}
      });
    }
  }

  function closeOthers(except) {
    dialogs().forEach(dialog => {
      if (dialog !== except) closeNow(dialog, { restoreFocus: false });
    });
  }

  function openDialog(dialog, trigger, focusTarget) {
    if (!dialog) return;
    lastTrigger = trigger || document.activeElement;
    closeOthers(dialog);

    if (dialog.open) {
      if (focusTarget) requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
      return;
    }

    // bfcacheや過去実装由来のopen属性だけが残っていた場合を正規化する。
    if (dialog.hasAttribute('open')) dialog.removeAttribute('open');

    try {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.classList.add('fallback-open');
        dialog.setAttribute('open', '');
      }
    } catch {
      dialog.classList.add('fallback-open');
      dialog.setAttribute('open', '');
    }

    lockPage();
    animateOpen(dialog);

    if (focusTarget) {
      setTimeout(() => {
        if (dialog.open || dialog.classList.contains('fallback-open')) {
          try { focusTarget.focus({ preventScroll: true }); } catch {}
        }
      }, 90);
    }
  }

  function triggerInfo(target) {
    if (target.closest('#stationButton') || target.closest('#openStations')) {
      return {
        dialog: document.getElementById('stationDialog'),
        focus: document.getElementById('stationSearch')
      };
    }
    if (target.closest('#openSettings')) {
      return { dialog: document.getElementById('settingsDialog'), focus: null };
    }
    if (target.closest('#openDataInfo')) {
      return { dialog: document.getElementById('dataDialog'), focus: null };
    }
    return null;
  }

  // app.jsに残る旧open属性操作より先に、Dialog操作をここで完結させる。
  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const info = triggerInfo(target);
    if (info) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openDialog(info.dialog, target.closest('button'), info.focus);
      return;
    }

    const closeButton = target.closest('[data-close-dialog]');
    if (closeButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeNow(document.getElementById(closeButton.dataset.closeDialog));
      return;
    }

    // 旧app.jsは駅選択後にremoveAttribute('open')するため、その前に正規のclose()でトップレイヤーから外す。
    if (target.closest('.station-select')) {
      const stationDialog = document.getElementById('stationDialog');
      if (stationDialog && stationDialog.open) {
        closeNow(stationDialog, { restoreFocus: false });
      }
    }
  }, true);

  dialogs().forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) closeNow(dialog);
    });

    dialog.addEventListener('close', () => {
      dialog.classList.remove('fallback-open');
      unlockPageIfDone();
    });

    dialog.addEventListener('cancel', () => {
      // Esc/システムキャンセルはブラウザ標準のcloseに任せる。
      requestAnimationFrame(unlockPageIfDone);
    });
  });

  function normalizeAllDialogs() {
    dialogs().forEach(dialog => {
      if (dialog.open || dialog.hasAttribute('open') || dialog.classList.contains('fallback-open')) {
        closeNow(dialog, { restoreFocus: false });
      }
    });
    unlockPageIfDone();
  }

  // Safariのbfcache復帰時に古いトップレイヤー状態を持ち越さない。
  window.addEventListener('pageshow', event => {
    if (event.persisted) normalizeAllDialogs();
  });

  window.__trainWatchDialogs = { openDialog, closeNow, normalizeAllDialogs };
})();