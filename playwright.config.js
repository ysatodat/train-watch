const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['user-scenarios.spec.js', 'ux-v6-scenarios.spec.js'],
  // v6 replaces the old sticky-header contract with a static header and a
  // dedicated scrolling body. The replacement behavior is covered in ux-v6.
  grepInvert: /長いモーダルをスクロールしても閉じるボタンが表示領域に残る・ヘッダーは不透明/,
  timeout: 35_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  projects: [
    {
      name: 'mobile-webkit',
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit',
        baseURL: 'http://127.0.0.1:4173',
        locale: 'ja-JP',
        timezoneId: 'Asia/Tokyo',
        serviceWorkers: 'block'
      }
    }
  ]
});
