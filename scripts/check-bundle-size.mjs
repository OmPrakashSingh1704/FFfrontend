#!/usr/bin/env node
/**
 * Bundle size budget enforcer.
 *
 * Runs after `vite build` and fails with a non-zero exit code when any chunk
 * (or the total) exceeds its budget. Vercel surfaces this as a deploy failure.
 *
 * Update budgets ONLY when you've justified the increase in the PR description.
 * Drifting budgets defeat the point.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync, brotliCompressSync } from 'node:zlib'

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const ASSETS_DIR = resolve(ROOT, 'dist', 'assets')

// Budgets are gzipped sizes (what users actually download). KB.
const BUDGETS = {
  // Per-prefix budgets. First match wins.
  perChunk: [
    { match: /^index-/,           label: 'entry',         gzipKB: 90,  initialPaint: true  },
    { match: /^vendor-react/,     label: 'react',         gzipKB: 20,  initialPaint: true  },
    { match: /^vendor-query/,     label: 'react-query',   gzipKB: 15,  initialPaint: true  },
    { match: /^vendor-sentry/,    label: 'sentry',        gzipKB: 10,  initialPaint: true  },
    // Async vendor chunks — load with their consumer pages, not at boot.
    { match: /^vendor-flow/,      label: 'xyflow',        gzipKB: 60,  initialPaint: false },
    { match: /^vendor-motion/,    label: 'framer-motion', gzipKB: 40,  initialPaint: false },
    { match: /^vendor-markdown/,  label: 'markdown',      gzipKB: 50,  initialPaint: false },
    // Default per-route page chunk.
    { match: /\.js$/,             label: 'route',         gzipKB: 30,  initialPaint: false },
  ],
  // Hard cap on what the user downloads on first paint:
  // entry chunk + react + react-query + sentry. Everything else is route-async.
  initialPaintGzipKB: 140,
}

const fmt = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

async function main() {
  let entries
  try {
    entries = await readdir(ASSETS_DIR)
  } catch (err) {
    console.error(`✗ dist/assets not found at ${ASSETS_DIR}. Did vite build run?`)
    process.exit(1)
  }

  const jsFiles = entries.filter((f) => f.endsWith('.js'))
  if (jsFiles.length === 0) {
    console.error('✗ No JS files in dist/assets — build is broken.')
    process.exit(1)
  }

  const failures = []
  const report = []
  let initialPaintGzip = 0

  for (const file of jsFiles) {
    const path = resolve(ASSETS_DIR, file)
    const buf = await readFile(path)
    const gz = gzipSync(buf).length
    const br = brotliCompressSync(buf).length
    const raw = buf.length

    const rule = BUDGETS.perChunk.find((b) => b.match.test(file))
    const budgetBytes = (rule?.gzipKB ?? 30) * 1024
    const isInitial = rule?.initialPaint === true
    if (isInitial) initialPaintGzip += gz

    const status = gz > budgetBytes ? 'FAIL' : 'OK'
    if (status === 'FAIL') {
      failures.push(
        `  ${file} → gzip ${fmt(gz)} > budget ${rule.gzipKB} KB (${rule.label})`,
      )
    }

    report.push({
      file,
      label: rule?.label ?? 'route',
      raw,
      gz,
      br,
      budget: budgetBytes,
      isInitial,
    })
  }

  // Print sorted report
  report.sort((a, b) => b.gz - a.gz)
  console.log('Bundle size report (sorted by gzip):')
  console.log(
    '  file                                                 label          raw      gzip     brotli   budget',
  )
  for (const r of report.slice(0, 30)) {
    const name = r.file.padEnd(52).slice(0, 52)
    const label = r.label.padEnd(14)
    console.log(
      `  ${name} ${label} ${fmt(r.raw).padStart(8)} ${fmt(r.gz).padStart(8)} ${fmt(r.br).padStart(8)} ${(r.budget / 1024 + ' KB').padStart(8)}`,
    )
  }

  console.log(
    `\nInitial paint (entry + vendor chunks): ${fmt(initialPaintGzip)} gzip / budget ${BUDGETS.initialPaintGzipKB} KB`,
  )

  if (initialPaintGzip > BUDGETS.initialPaintGzipKB * 1024) {
    failures.push(
      `  initial paint ${fmt(initialPaintGzip)} > budget ${BUDGETS.initialPaintGzipKB} KB`,
    )
  }

  if (failures.length > 0) {
    console.error(`\n✗ Bundle budget exceeded:\n${failures.join('\n')}`)
    console.error(
      '\nIf this is intentional, update budgets in scripts/check-bundle-size.mjs and explain why in the PR.',
    )
    process.exit(1)
  }

  console.log('\n✓ All bundle budgets satisfied.')
}

main().catch((err) => {
  console.error('Bundle check crashed:', err)
  process.exit(1)
})
