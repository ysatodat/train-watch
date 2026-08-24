import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['user-scenarios.spec.ts'],
  timeout: 40_000,
  expect: { timeout: 10_000 },
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
