(() => {
  'use strict';

  const root = document.documentElement;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = '子どもと一緒に、電車の到着・発車・通過などの見どころを楽しく見る親子向け電車ウォッチ。TXと京成本線に対応した非公式Webアプリ。';

  // Focus rings are for keyboard navigation. A dialog opening itself should not
  // make the first close button look selected on touch devices.
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') root.classList.add('keyboard-nav');
  }, true);
  document.addEventListener('pointerdown', () => root.classList.remove('keyboard-nav'), true);
  document.addEventListener('touchstart', () => root.classList.remove('keyboard-nav'), { capture: true, passive: true });

  function wrapDialog(dialog) {
    if (!(dialog instanceof HTMLDialogElement) || !dialog.classList.contains('native-dialog')) return;
    const shell = dialog.querySelector(':scope > .dialog-shell');
    if (!shell || shell.querySelector(':scope > .dialog-body')) return;
    const header = shell.querySelector(':scope > .dialog-header');
    if (!header) return;
    const body = document.createElement('div');
    body.className = 'dialog-body';
    [...shell.childNodes].forEach(node => { if (node !== header) body.appendChild(node); });
    shell.appendChild(body);
    const heading = header.querySelector('h2');
    if (heading && !heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  }

  function focusHeading(dialog) {
    if (!(dialog instanceof HTMLDialogElement) || !dialog.open) return;
    wrapDialog(dialog);
    const heading = dialog.querySelector('.dialog-header h2');
    if (!heading) return;
    heading.setAttribute('tabindex', '-1');
    requestAnimationFrame(() => {
      if (!dialog.open) return;
      try { heading.focus({ preventScroll: true }); } catch {}
    });
  }

  function prepareDialog(dialog) {
    wrapDialog(dialog);
    if (dialog.dataset.uxV6Prepared === '1') return;
    dialog.dataset.uxV6Prepared = '1';
    dialog.addEventListener('toggle', () => { if (dialog.open) focusHeading(dialog); });
  }

  document.querySelectorAll('dialog.native-dialog').forEach(prepareDialog);

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') {
        record.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          if (node.matches?.('dialog.native-dialog')) prepareDialog(node);
          node.querySelectorAll?.('dialog.native-dialog').forEach(prepareDialog);
        });
      }
      if (record.type === 'attributes' && record.target instanceof HTMLDialogElement && record.attributeName === 'open') {
        if (record.target.open) focusHeading(record.target);
      }
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });

  // showModal() focuses the first focusable element before MutationObserver runs.
  // Capture focus synchronously and move it to the heading when that happens.
  document.addEventListener('focusin', event => {
    const close = event.target.closest?.('dialog.native-dialog .dialog-close');
    if (!close) return;
    const dialog = close.closest('dialog.native-dialog');
    if (!dialog?.open || root.classList.contains('keyboard-nav')) return;
    const heading = dialog.querySelector('.dialog-header h2');
    if (!heading) return;
    heading.setAttribute('tabindex', '-1');
    try { heading.focus({ preventScroll: true }); } catch {}
  }, true);

  // Remove legacy TX-only wording if an older TX enhancement writes it before
  // the current location layer finishes loading.
  function normalizeLegacyCopy() {
    const brand = document.querySelector('.brand-lockup small');
    if (brand?.textContent.includes('TX専用')) brand.textContent = 'TRAIN WATCH · 非公式';
    const footer = document.querySelector('.app-footer p');
    if (footer?.textContent.includes('TX専用')) footer.textContent = 'でんしゃくるよ！ β · 非公式';
  }
  normalizeLegacyCopy();
  new MutationObserver(normalizeLegacyCopy).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
