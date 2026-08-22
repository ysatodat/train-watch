const { test, expect } = require('@playwright/test');

const FIXED_NOW = new Date('2026-08-23T12:00:00+09:00').valueOf();

async function prepare(page, { seenIntro = true } = {}) {
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(({ now, seen }) => {
    const RealDate = Date;
    class FixedDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return now; }
    }
    window.Date = FixedDate;
    localStorage.clear();
    if (seen) localStorage.setItem('denshaKuruyoIntroV2', 'seen');
  }, { now: FIXED_NOW, seen: seenIntro });
}

test('初回ユーザーが3画面チュートリアルを読んで使い始められる', async ({ page }) => {
  await prepare(page, { seenIntro: false });
  await page.goto('/?station=TX19');

  const dialog = page.locator('#aboutDialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('[data-tutorial-step="0"] h3')).toHaveText('駅をえらぼう');

  await page.locator('#tutorialNext').click();
  await expect(page.locator('[data-tutorial-step="1"] h3')).toHaveText('次の見どころがわかる');

  await page.locator('#tutorialNext').click();
  await expect(page.locator('[data-tutorial-step="2"] h3')).toHaveText('動く瞬間も楽しもう');

  await page.locator('#tutorialDone').click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('#countdown')).toBeVisible();
  await expect(page.locator('#txSpecial')).toBeVisible();
});

test('TX路線図から駅を変更でき、20駅が選択肢として見える', async ({ page }) => {
  await prepare(page);
  await page.goto('/?station=TX19');
  await expect(page.locator('#txSpecial')).toBeVisible();

  await page.locator('#stationButton').click();
  await expect(page.locator('#stationDialog')).toBeVisible();
  await expect(page.locator('.tx-route-intro')).toContainText('20駅');
  await expect(page.locator('#stationDialog .station-search')).toBeHidden();
  await expect(page.locator('#stationDialog .station-row')).toHaveCount(20);

  await page.locator('#stationDialog .station-row').filter({ hasText: '流山おおたかの森' }).locator('.station-select').click();
  await expect(page.locator('#stationDialog')).not.toBeVisible();
  await expect(page.locator('#stationName')).toHaveText('流山おおたかの森');
  await expect(page.locator('#txSpecialStation')).toContainText('流山おおたかの森');
});

test('お知らせは説明を読んでから明示的にONにできる', async ({ page }) => {
  await prepare(page);
  await page.goto('/?station=TX19');

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

test('研究学園では2000系・3000系だけを会える車両として案内する', async ({ page }) => {
  await prepare(page);
  await page.goto('/?station=TX19');
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

test('守谷より手前ではTXの3車種すべてを候補として案内する', async ({ page }) => {
  await prepare(page);
  await page.goto('/?station=TX12');
  await expect(page.locator('#txVehicleAtStationCount')).toHaveText('3種類');

  await page.locator('#openTxVehicleGuide').click();
  await expect(page.locator('#txVehicleSummary')).toContainText('3種類');
  await expect(page.locator('[data-vehicle="TX-1000"] .tx-found-button')).toBeEnabled();
});

test('TXならではの予告が利用者向けの言葉で表示される', async ({ page }) => {
  await prepare(page);
  await page.goto('/?station=TX19');
  await expect(page.locator('#txNextPassTitle')).not.toHaveText('探しています');
  await expect(page.locator('#txNextPassMeta')).toContainText('通過時刻は目安');
  await expect(page.locator('#txNextRareTitle')).not.toHaveText('探しています');
});

test('小さいiPhone幅でもページ全体が横にはみ出さない', async ({ page }) => {
  await prepare(page);
  await page.goto('/?station=TX19');
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
