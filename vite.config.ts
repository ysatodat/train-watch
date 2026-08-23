import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  base: process.env.GITHUB_PAGES === 'true' ? '/train-watch/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'でんしゃくるよ！｜TRAIN WATCH',
        short_name: 'でんしゃくるよ！',
        description: 'TXと京成本線に対応した非公式の親子向け電車ウォッチ。',
        theme_color: '#2f5d68',
        background_color: '#f3f4f1',
        display: 'standalone',
        start_url: process.env.GITHUB_PAGES === 'true' ? '/train-watch/' : '/',
        scope: process.env.GITHUB_PAGES === 'true' ? '/train-watch/' : '/',
        lang: 'ja',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/data\/.*\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'train-watch-data-v1',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 12, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      devOptions: { enabled: false }
    })
  ],
  server: { host: '127.0.0.1', port: 4173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { sourcemap: true, target: 'es2022' }
}));
