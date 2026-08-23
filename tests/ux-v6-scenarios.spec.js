const { test, expect } = require('@playwright/test');

const FIXED_NOW = new Date('2026-08-23T12:00:00+09:00').valueOf();

async function prepare(page) {
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(initialNow => {
    const RealDate = Date;
    let currentNow = initialNow;
    class FixedDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : [currentNow])); }
      static now() { return currentNow; }
    }
    window.Date = FixedDate;
    localStorage.clear();
    localStorage.setItem('denshaKuruyoIntroV2', 'seen');
    sessionStorage.setItem('__trainWatchPrepared', '1');
  }, FIXED_NOW);
}

test('モーダルはヘッダーではなくボディだけがスクロールする', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  await page.locator('#openTxVehicleGuide').click();

  const dialog = page.locator('#txVehicleDialog');
  const shell = dialog.locator('.dialog-shell');
  const header = dialog.locator('.dialog-header');
  const body = dialog.locator('.dialog-body');
  const close = dialog.locator('.dialog-close');
  await expect(dialog).toBeVisible();
  await expect(body).toHaveCount(1);

  const before = await header.boundingBox();
  const metrics = await shell.evaluate(el => {
    const style = getComputedStyle(el);
    return { overflowY: style.overflowY, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  });
  expect(['hidden', 'clip']).toContain(metrics.overflowY);

  await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(100);
  const bodyScroll = await body.evaluate(el => el.scrollTop);
  expect(bodyScroll).toBeGreaterThan(0);

  const after = await header.boundingBox();
  expect(before).toBeTruthy();
  expect(after).toBeTruthy();
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
  expect(await header.evaluate(el => getComputedStyle(el).position)).toBe('static');

  const closeBox = await close.boundingBox();
  const viewport = page.viewportSize();
  expect(closeBox).toBeTruthy();
  expect(closeBox.y).toBeGreaterThanOrEqual(0);
  expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(viewport.height);
});

test('場所ダイアログは検索へ勝手にフォーカスせず、路線切替でもキーボードを要求しない', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  await page.locator('#stationButton').click();
  await expect(page.locator('#stationDialog')).toBeVisible();

  const search = page.locator('#locationSearch');
  const close = page.locator('#stationDialog .dialog-close');
  await expect(search).not.toBeFocused();
  await expect(close).not.toBeFocused();
  await expect(page.locator('#stationDialogTitle')).toBeFocused();

  await page.locator('[data-location-rail="keisei"]').click();
  await expect(page.locator('.location-station-choice')).toHaveCount(42);
  await expect(search).not.toBeFocused();
  await expect(close).not.toBeFocused();
});

test('現在地はタップ領域として見え、押下フィードバック用スタイルが有効', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  const button = page.locator('.location-context-button');
  const style = await button.evaluate(el => {
    const s = getComputedStyle(el);
    return { minHeight: parseFloat(s.minHeight), borderTopWidth: parseFloat(s.borderTopWidth), backgroundColor: s.backgroundColor };
  });
  expect(style.minHeight).toBeGreaterThanOrEqual(44);
  expect(style.borderTopWidth).toBeGreaterThan(0);
  expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

  const hasTouchRule = await page.evaluate(() => [...document.styleSheets].some(sheet => {
    try { return [...sheet.cssRules].some(rule => rule.cssText?.includes('.touchable:not(:disabled):active') && rule.cssText.includes('box-shadow')); }
    catch { return false; }
  }));
  expect(hasTouchRule).toBe(true);
});

test('TXモードにTX専用表記や通常状態の警告赤を持ち込まない', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=tx&station=TX19');
  await page.waitForTimeout(250);
  await expect(page.locator('body')).not.toContainText('TX専用');
  await expect(page.locator('.brand-lockup small')).toHaveText('TRAIN WATCH · 非公式');
  const palette = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return { accent: s.getPropertyValue('--brand-coral').trim(), danger: s.getPropertyValue('--danger').trim() };
  });
  expect(palette.accent.toLowerCase()).toBe('#4f7568');
  expect(palette.danger.toLowerCase()).toBe('#b3261e');
});

test('京成には京成ならではと車両ずかんがあり、4車種を記録できる', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=keisei&station=KS22');
  const special = page.locator('#keiseiSpecial');
  await expect(special).toBeVisible();
  await expect(page.locator('#keiseiLinerTitle')).not.toHaveText('探しています');
  await expect(page.locator('#keiseiAirportTitle')).not.toHaveText('探しています');

  await page.locator('#openKeiseiVehicleGuide').click();
  const dialog = page.locator('#keiseiVehicleDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.keisei-vehicle-item')).toHaveCount(4);
  await expect(dialog).toContainText('AE形');
  await expect(dialog).toContainText('3200形');
  await expect(dialog).toContainText('3100形');
  await expect(dialog).toContainText('3000形');
  await expect(dialog.locator('.dialog-body')).toHaveCount(1);

  const found = dialog.locator('[data-vehicle="AE"] .keisei-found-button');
  await found.click();
  await expect(found).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#keiseiVehicleSummary')).toContainText('1 / 4');
});
