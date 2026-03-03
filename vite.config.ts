import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type ServerOptions } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

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
