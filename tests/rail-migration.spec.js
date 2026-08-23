const { test, expect } = require('@playwright/test');

test('既存TXユーザーは2路線化しても前回の駅を引き継ぐ', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('denshaKuruyoIntroV2','seen');
    localStorage.setItem('denshaKuruyoV1', JSON.stringify({
      station:'TX12', includePass:true, dir:'both', favorites:['TX12'], sound:true, vibrate:true
    }));
  });

  await page.goto('/');
  await expect(page.locator('#stationCode')).toHaveText('TX12');
  await expect(page.locator('#stationName')).toHaveText('流山おおたかの森');
  await expect(page.locator('#stationDialog')).not.toBeVisible();
  await expect(page.locator('.location-context-button')).toBeVisible();
  expect(page.url()).toContain('station=TX12');
});
