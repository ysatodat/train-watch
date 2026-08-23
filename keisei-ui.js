(() => {
  'use strict';
  if (window.RailContext?.rail !== 'keisei') return;

  const replaceDirection = text => String(text || '')
    .replaceAll('つくば方面', '成田・空港方面')
    .replaceAll('秋葉原方面', '上野・押上方面');

  function normalizeCopy() {
    const meta = document.getElementById('metaRow');
    if (meta) {
      const next = replaceDirection(meta.textContent);
      if (next !== meta.textContent) meta.textContent = next;
    }
    const session = document.getElementById('sessionNote');
    if (session && session.textContent.includes('到着・発車・通過')) {
      session.textContent = session.textContent.replace('到着・発車・通過', '到着・発車');
    }
  }

  const meta = document.getElementById('metaRow');
  const session = document.getElementById('sessionNote');
  const observer = new MutationObserver(normalizeCopy);
  if (meta) observer.observe(meta, { childList: true, subtree: true, characterData: true });
  if (session) observer.observe(session, { childList: true, subtree: true, characterData: true });
  normalizeCopy();

  // app.js keeps the generic/TX sharing copy for backward compatibility. In
  // Keisei mode, intercept it at capture phase so we never promise pass events.
  const share = document.getElementById('shareButton');
  if (share) {
    share.addEventListener('click', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const code = document.getElementById('stationCode')?.textContent?.trim() || 'KS22';
      const name = document.getElementById('stationName')?.textContent?.trim() || '京成船橋';
      const url = new URL(location.href);
      url.searchParams.set('rail', 'keisei');
      url.searchParams.set('station', code);
      const text = `${name}駅で電車を見よう！\n「でんしゃくるよ！」で、到着・発車の見どころを追えるよ。`;
      try {
        if (navigator.share) await navigator.share({ title: `${name}駅｜でんしゃくるよ！`, text, url: url.href });
        else {
          await navigator.clipboard.writeText(`${text}\n${url.href}`);
          const toast = document.getElementById('toast');
          if (toast) { toast.textContent = 'URLをコピーしました'; toast.hidden = false; setTimeout(() => { toast.hidden = true; }, 2200); }
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          const toast = document.getElementById('toast');
          if (toast) { toast.textContent = '共有できませんでした'; toast.hidden = false; setTimeout(() => { toast.hidden = true; }, 2200); }
        }
      }
    }, true);
  }

  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
})();
