import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type ServerOptions } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'

const HTTPS_KEY_ENV = 'DEV_SSL_KEY'
const HTTPS_CERT_ENV = 'DEV_SSL_CERT'

const resolveCertPath = (file: string) => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(currentDir, '.cert', file)
}

const getHttpsConfig = (): ServerOptions['https'] => {
  const keyPath = process.env[HTTPS_KEY_ENV] ?? resolveCertPath('localhost-key.pem')
  const certPath = process.env[HTTPS_CERT_ENV] ?? resolveCertPath('localhost-cert.pem')

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    }
  }

  return undefined
}

const httpsConfig = getHttpsConfig()

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png', 'logo-mark.svg'],
      manifest: {
        name: 'FoundersLib',
        short_name: 'FoundersLib',
        description: 'Fundraising OS for founders and investor partners.',
        theme_color: '#171717',
        background_color: '#FAFAFA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/app',
        scope: '/',
        lang: 'en',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/ws\//,
          /^\/admin/,
          /^\/health/,
          /^\/metrics/,
          /^\/static\//,
          /^\/media\//,
        ],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/ws/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    ...(process.env.ANALYZE === 'true'
      ? [
          visualizer({
            filename: 'dist/bundle-report.html',
            template: 'treemap',
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : [])
  ],
  build: {
    rollupOptions: {
      output: {
        // Split heavy third-party deps into named chunks. Browser caches them
        // separately from app code, so a route deploy doesn't bust the React/
        // xyflow/sentry caches. Keeps the entry chunk small.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-sentry': ['@sentry/react'],
          'vendor-flow': ['@xyflow/react'],
          'vendor-motion': ['framer-motion'],
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
        },
      },
    },
    // Warn (not fail) at 500 KB raw — actual budget enforcement is in scripts/check-bundle-size.mjs.
    chunkSizeWarningLimit: 500,
  },
  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    https: httpsConfig
  },
  preview: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
    https: httpsConfig
  }
})
