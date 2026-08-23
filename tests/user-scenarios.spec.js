const { test, expect } = require('@playwright/test');

const FIXED_NOW = new Date('2026-08-23T12:00:00+09:00').valueOf();

async function prepare(page, { seenIntro = true, now = FIXED_NOW } = {}) {
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(({ initialNow, seen }) => {
    const RealDate = Date;
    let currentNow = initialNow;
    window.__setTestNow = value => { currentNow = value; };
    class FixedDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : [currentNow])); }
      static now() { return currentNow; }
    }
    window.Date = FixedDate;
    if (!sessionStorage.getItem('__trainWatchPrepared')) {
      localStorage.clear();
      if (seen) localStorage.setItem('denshaKuruyoIntroV2', 'seen');
      sessionStorage.setItem('__trainWatchPrepared', '1');
    }
  }, { initialNow: now, seen: seenIntro });
}

async function setNow(page, iso) {
  const value = new Date(iso).valueOf();
  await page.evaluate(ms => window.__setTestNow(ms), value);
  await page.waitForTimeout(1150);
}

test('初回ユーザーはまず見る場所を選び、そのあと3画面チュートリアルへ進む', async ({ page }) => {
  await prepare(page, { seenIntro: false });
  await page.goto('/');

  const locationDialog = page.locator('#stationDialog');
  await expect(locationDialog).toBeVisible();
  await expect(page.locator('#stationDialogTitle')).toHaveText('どこで電車を見る？');
  await expect(locationDialog.locator('.dialog-close')).toBeHidden();
  await expect(page.locator('.recent-locations')).toBeHidden();

  await page.locator('[data-location-rail="keisei"]').click();
  await expect(page.locator('.location-station-choice')).toHaveCount(42);
  await page.locator('.location-station-choice').filter({ hasText: '京成船橋' }).click();
  await page.waitForURL(/rail=keisei.*station=KS22|station=KS22.*rail=keisei/);
  await expect(page.locator('#stationCode')).toHaveText('KS22');
  await expect(page.locator('#stationName')).toHaveText('京成船橋');

  const tutorial = page.locator('#aboutDialog');
  await expect(tutorial).toBeVisible();
  await expect(page.locator('[data-tutorial-step="0"] h3')).toHaveText('次の見どころがわかる');
});

test('初回説明は場所選択後、1画面1メッセージの3画面で読める', async ({ page }) => {
  await prepare(page, { seenIntro: false });
  await page.goto('/?rail=tx&station=TX19');

  const dialog = page.locator('#aboutDialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('[data-tutorial-step="0"] h3')).toHaveText('次の見どころがわかる');

  await page.locator('#tutorialNext').click();
  await expect(page.locator('[data-tutorial-step="1"] h3')).toHaveText('来た瞬間を楽しもう');

  await page.locator('#tutorialNext').click();
  await expect(page.locator('[data-tutorial-step="2"] h3')).toHaveText('見逃しそうならお知らせ');

  await page.locator('#tutorialDone').click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('#countdown')).toBeVisible();
  await expect(page.locator('#txSpecial')).toBeVisible();
});

test('通常画面は現在地だけを小さく見せ、路線切替やお気に入り駅UIを常駐させない', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  await expect(page.locator('.location-context-button')).toBeVisible();
  await expect(page.locator('.location-rail-label')).toHaveText('TX');
  await expect(page.locator('#stationName')).toHaveText('研究学園');
  await expect(page.locator('.rail-switch')).toHaveCount(0);
  await expect(page.locator('#favoriteToggle')).toBeHidden();
  await expect(page.locator('.favorites-section')).toBeHidden();

  const contextBox = await page.locator('.location-context').boundingBox();
  const heroBox = await page.locator('#hero').boundingBox();
  expect(contextBox).toBeTruthy();
  expect(heroBox).toBeTruthy();
  expect(contextBox.height).toBeLessThanOrEqual(56);
  expect(heroBox.y - (contextBox.y + contextBox.height)).toBeLessThanOrEqual(16);
});

test('見る場所ダイアログでTX20駅から駅を変更できる', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  await expect(page.locator('#txSpecial')).toBeVisible();

  await page.locator('#stationButton').click();
  await expect(page.locator('#stationDialog')).toBeVisible();
  await expect(page.locator('#stationDialogTitle')).toHaveText('見る場所を変える');
  await expect(page.locator('[data-location-rail="tx"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.location-station-choice')).toHaveCount(20);

  await page.locator('.location-station-choice').filter({ hasText: '流山おおたかの森' }).click();
  await page.waitForURL(/station=TX12/);
  await expect(page.locator('#stationName')).toHaveText('流山おおたかの森');
  await expect(page.locator('#txSpecialStation')).toContainText('流山おおたかの森');
});

test('見る場所からTXと京成を切り替え、各路線の前回位置へ戻れる', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');

  await page.locator('#stationButton').click();
  await page.locator('[data-location-rail="keisei"]').click();
  await expect(page.locator('.location-station-choice')).toHaveCount(42);
  await page.locator('.location-station-choice').filter({ hasText: '京成船橋' }).click();
  await page.waitForURL(/rail=keisei.*station=KS22|station=KS22.*rail=keisei/);
  await expect(page.locator('.location-rail-label')).toHaveText('京成');
  await expect(page.locator('#stationName')).toHaveText('京成船橋');
  await expect(page.locator('#countdown')).not.toHaveText('--:--');
  await expect(page.locator('#txSpecial')).toHaveCount(0);

  await page.locator('#stationButton').click();
  await expect(page.locator('.recent-location-list')).toContainText('研究学園');
  await expect(page.locator('.recent-location-list')).toContainText('京成船橋');
  await page.locator('[data-location-rail="tx"]').click();
  await page.locator('.location-station-choice').filter({ hasText: '研究学園' }).click();
  await page.waitForURL(/rail=tx.*station=TX19|station=TX19.*rail=tx/);
  await expect(page.locator('.location-rail-label')).toHaveText('TX');
  await expect(page.locator('#stationName')).toHaveText('研究学園');
});

test('お知らせは説明を読んでから明示的にONにできる', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');

  const entry = page.locator('#notifyButton');
  await expect(entry).toHaveAttribute('aria-pressed', 'false');
  await entry.click();

  await expect(page.locator('#notifyDialog')).toBeVisible();
  await expect(page.locator('#notifyDialog')).toContainText('3分前と30秒前');
  await expect(page.locator('#notifyDialog')).toContainText('Safariを閉じた後のプッシュ通知ではありません');
  await expect(entry).toHaveAttribute('aria-pressed', 'false');

  await page.locator('#notifyToggleButton').click();
  await expect(entry).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#notifyStatusText')).toHaveText('お知らせ中');
});

test('停まった→動いたを押すと同じ列車の停まったへ戻らず、見送りの余韻が出る', async ({ page }) => {
  await prepare(page, { now: new Date('2026-08-23T12:20:50+09:00').valueOf() });
  await page.goto('/?rail=tx&station=TX19');

  const action = page.locator('#heroMomentAction');
  await expect(action).toBeVisible();
  await expect(action).toHaveText('停まった！');
  const visitId = await action.getAttribute('data-visit');

  await action.click();
  await expect(action).toHaveText('動いた！');
  await action.click();

  await expect(page.locator('#countdown')).toHaveText('いってらっしゃい！');
  await expect(page.locator('#heroMessage')).toContainText('動く瞬間');
  await expect(action).toBeHidden();

  await setNow(page, '2026-08-23T12:20:55+09:00');
  const nextVisit = await action.getAttribute('data-visit');
  if (nextVisit) expect(nextVisit).not.toBe(visitId);
  await expect(action).not.toHaveText('停まった！');
});

test('時刻を過ぎても未到着ならまだかなになり、まだ来てないでその列車を待ち続けられる', async ({ page }) => {
  await prepare(page, { now: new Date('2026-08-23T12:21:20+09:00').valueOf() });
  await page.goto('/?rail=tx&station=TX19');

  await expect(page.locator('#heroLabel')).toHaveText('到着予定を過ぎています');
  await expect(page.locator('#countdown')).toHaveText('まだかな？');
  await expect(page.locator('#heroMomentAction')).toHaveText('停まった！');
  const waitButton = page.locator('#heroDelayAction');
  await expect(waitButton).toBeVisible();
  await expect(waitButton).toHaveText('まだ来てない');

  await waitButton.click();
  await expect(page.locator('#countdown')).toHaveText('待ってる');
  await expect(page.locator('#heroMomentAction')).toHaveText('停まった！');
  await expect(waitButton).toBeHidden();

  await setNow(page, '2026-08-23T12:23:00+09:00');
  await expect(page.locator('#countdown')).toHaveText('待ってる');
  await expect(page.locator('#heroMomentAction')).toHaveText('停まった！');
});

test('研究学園では2000系・3000系だけを会える車両として案内する', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  await expect(page.locator('#txVehicleAtStationTitle')).toHaveText('2000系・3000系');

  await page.locator('#openTxVehicleGuide').click();
  await expect(page.locator('#txVehicleDialog')).toBeVisible();
  await expect(page.locator('#txVehicleSummary')).toContainText('2種類');

  const tx1000 = page.locator('[data-vehicle="TX-1000"]');
  await expect(tx1000).toHaveClass(/is-unavailable/);
  await expect(tx1000.locator('.tx-found-button')).toBeDisabled();

  const tx2000Button = page.locator('[data-vehicle="TX-2000"] .tx-found-button');
  await expect(tx2000Button).toBeEnabled();
  await tx2000Button.click();
  await expect(tx2000Button).toHaveAttribute('aria-pressed', 'true');
});

test('車両ずかんを開いたままでも写真DOMが毎秒作り直されない', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  await page.locator('#openTxVehicleGuide').click();
  await expect(page.locator('#txVehicleDialog')).toBeVisible();

  const photo = await page.locator('[data-vehicle="TX-2000"] .tx-vehicle-photo').elementHandle();
  expect(photo).toBeTruthy();
  await page.waitForTimeout(2300);
  expect(await photo.evaluate(node => node.isConnected)).toBe(true);
});

test('長いモーダルをスクロールしても閉じるボタンが表示領域に残る・ヘッダーは不透明', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  await page.locator('#openTxVehicleGuide').click();
  const dialog = page.locator('#txVehicleDialog');
  const shell = dialog.locator('.dialog-shell');
  const header = dialog.locator('.dialog-header');
  const close = dialog.locator('.dialog-close');
  await expect(dialog).toBeVisible();

  await shell.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(100);
  const styles = await header.evaluate(el => {
    const style = getComputedStyle(el);
    return {
      position: style.position,
      backgroundColor: style.backgroundColor,
      backdropFilter: style.backdropFilter,
      webkitBackdropFilter: style.webkitBackdropFilter
    };
  });
  expect(styles.position).toBe('sticky');
  expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(styles.backgroundColor).not.toContain('0.96');
  expect(styles.backdropFilter === 'none' || styles.backdropFilter === '').toBe(true);
  expect(styles.webkitBackdropFilter === 'none' || styles.webkitBackdropFilter === '').toBe(true);

  const box = await close.boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  await close.click();
  await expect(dialog).not.toBeVisible();
});

test('守谷より手前ではTXの3車種すべてを候補として案内する', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX12');
  await expect(page.locator('#txVehicleAtStationCount')).toHaveText('3種類');

  await page.locator('#openTxVehicleGuide').click();
  await expect(page.locator('#txVehicleSummary')).toContainText('3種類');
  await expect(page.locator('[data-vehicle="TX-1000"] .tx-found-button')).toBeEnabled();
});

test('TXならではの予告が利用者向けの言葉で表示される', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  await expect(page.locator('#txNextPassTitle')).not.toHaveText('探しています');
  await expect(page.locator('#txNextPassMeta')).toContainText('通過時刻は目安');
  await expect(page.locator('#txNextRareTitle')).not.toHaveText('探しています');
});

test('小さいiPhone幅でもページ全体と場所選択が横にはみ出さない', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  await expect(page.locator('#txSpecial')).toBeVisible();

  await page.setViewportSize({ width: 320, height: 780 });
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

  await page.locator('#stationButton').click();
  await expect(page.locator('#stationDialog')).toBeVisible();
  const dialogOverflow = await page.locator('#stationDialog .dialog-shell').evaluate(el => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth
  }));
  expect(dialogOverflow.scrollWidth).toBeLessThanOrEqual(dialogOverflow.clientWidth + 1);
});