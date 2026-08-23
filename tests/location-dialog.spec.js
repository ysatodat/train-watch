const { test, expect } = require('@playwright/test');

async function prepare(page) {
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('denshaKuruyoIntroV2','seen');
    localStorage.setItem('denshaKuruyoLocationReadyV1','1');
  });
}

test('場所選択を開いたら路線タブと検索が最初から見え、現在駅へ勝手にスクロールしない', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=keisei&station=KS22');
  await page.locator('#stationButton').click();

  const dialog=page.locator('#stationDialog');
  const tabs=page.locator('.location-rail-tabs');
  const search=page.locator('#locationSearch');
  await expect(dialog).toBeVisible();
  await expect(tabs).toBeVisible();
  await expect(search).toBeVisible();
  await page.waitForTimeout(180);

  const scrollTop=await dialog.locator('.dialog-shell').evaluate(el=>el.scrollTop);
  expect(scrollTop).toBeLessThanOrEqual(2);
  const headerBox=await dialog.locator('.dialog-header').boundingBox();
  const tabsBox=await tabs.boundingBox();
  expect(headerBox).toBeTruthy();
  expect(tabsBox).toBeTruthy();
  expect(tabsBox.y).toBeGreaterThanOrEqual(headerBox.y+headerBox.height-1);
});

test('未訪問のもう一方の路線を最近見た場所として捏造しない', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=keisei&station=KS22');
  await page.locator('#stationButton').click();
  await expect(page.locator('.recent-location')).toHaveCount(1);
  await expect(page.locator('.recent-location')).toContainText('京成船橋');
  await expect(page.locator('.recent-location-list')).not.toContainText('研究学園');
});

test('京成モードの電車イラストは京成ブルーを使う', async ({ page }) => {
  await prepare(page);
  await page.goto('/?rail=keisei&station=KS22');
  await expect(page.locator('#countdown')).not.toHaveText('--:--');
  const color=await page.locator('.train-illustration').evaluate(el=>getComputedStyle(el).color);
  expect(color).toBe('rgb(0, 91, 172)');
});
