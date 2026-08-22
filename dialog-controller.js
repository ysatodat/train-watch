(() => {
  'use strict';

  const DIALOG_IDS = ['stationDialog', 'settingsDialog', 'dataDialog'];
  const dialogs = () => DIALOG_IDS.map(id => document.getElementById(id)).filter(Boolean);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  let lastTrigger = null;
  let previousBodyOverflow = '';

  function animateOpen(dialog) {
    if (reduceMotion || !window.gsap) return;
    const shell = dialog.querySelector('.dialog-shell');
    if (!shell) return;
    window.gsap.killTweensOf(shell);
    window.gsap.fromTo(
      shell,
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.22, ease: 'power2.out', clearProps: 'transform,opacity' }
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
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
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

  function prepareStationDialog(dialog) {
    if (!dialog || dialog.id !== 'stationDialog') return;
    const search = document.getElementById('stationSearch');
    const list = document.getElementById('stationList');

    if (search && search.value) {
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (list) list.scrollTop = 0;

    setTimeout(() => {
      const current = dialog.querySelector('.station-row.current');
      if (current) current.scrollIntoView({ block: 'center' });
    }, 60);
  }

  function openDialog(dialog, trigger, focusTarget) {
    if (!dialog) return;
    lastTrigger = trigger || document.activeElement;
    closeOthers(dialog);

    if (dialog.open) return;
    if (dialog.hasAttribute('open')) dialog.removeAttribute('open');

    prepareStationDialog(dialog);

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

    // iPhoneではDialogを開いただけでキーボードを出さない。
    // マウス/トラックパッド環境だけ検索欄へ自動フォーカスする。
    if (focusTarget && finePointer) {
      setTimeout(() => {
        if (dialog.open || dialog.classList.contains('fallback-open')) {
          try { focusTarget.focus({ preventScroll: true }); } catch {}
        }
      }, 80);
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

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const info = triggerInfo(target);
    if (info) {
      event.preventDefault();
      openDialog(info.dialog, target.closest('button'), info.focus);
      return;
    }

    const closeButton = target.closest('[data-close-dialog]');
    if (closeButton) {
      event.preventDefault();
      closeNow(document.getElementById(closeButton.dataset.closeDialog));
      return;
    }

    // 駅選択はapp.jsが値を更新する前に正規のclose()でトップレイヤーから外す。
    if (target.closest('.station-select')) {
      const stationDialog = document.getElementById('stationDialog');
      if (stationDialog && stationDialog.open) closeNow(stationDialog, { restoreFocus: false });
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

  window.addEventListener('pageshow', event => {
    if (event.persisted) normalizeAllDialogs();
  });

  window.__trainWatchDialogs = { openDialog, closeNow, normalizeAllDialogs };
})();