import { renameSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const FILES = [
  'pwa-64x64.png',
  'pwa-192x192.png',
  'pwa-512x512.png',
  'maskable-icon-512x512.png',
  'apple-touch-icon-180x180.png',
  'favicon.ico',
]

const SRC_DIR = 'src/assets'
const DEST_DIR = 'public'

for (const file of FILES) {
  const src = join(SRC_DIR, file)
  const dest = join(DEST_DIR, file)
  if (existsSync(src)) {
    renameSync(src, dest)
    console.log(`moved ${file} -> ${DEST_DIR}/`)
  }
}
