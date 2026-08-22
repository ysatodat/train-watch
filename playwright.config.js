const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'user-scenarios.spec.js',
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
