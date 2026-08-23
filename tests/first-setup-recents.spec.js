const { test, expect } = require('@playwright/test');

test('初回に京成を選んだ人へ仮表示のTXを最近見た場所として残さない', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('__firstSetupPrepared')) {
      localStorage.clear();
      localStorage.setItem('denshaKuruyoIntroV2','seen');
      sessionStorage.setItem('__firstSetupPrepared','1');
    }
  });

  await page.goto('/');
  await expect(page.locator('#stationDialog')).toBeVisible();
  await page.locator('[data-location-rail="keisei"]').click();
  await page.locator('.location-station-choice').filter({hasText:'京成船橋'}).click();
  await page.waitForURL(/station=KS22/);
  await expect(page.locator('#stationName')).toHaveText('京成船橋');

  await page.locator('#stationButton').click();
  await expect(page.locator('.recent-location')).toHaveCount(1);
  await expect(page.locator('.recent-location-list')).toContainText('京成船橋');
  await expect(page.locator('.recent-location-list')).not.toContainText('研究学園');
});
