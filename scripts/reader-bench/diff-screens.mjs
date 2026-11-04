#!/usr/bin/env node
// SPIKE: perceptual diff of two screenshot folders (e.g. the WebView baseline vs a prototype).
//   node scripts/reader-bench/diff-screens.mjs <baselineDir> <candidateDir> <outDir> [--threshold 0.1]
// Every PNG name present in both folders is compared; diff images and diff.json land in outDir.
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

const [baseline, candidate, outDir, ...rest] = process.argv.slice(2)
if (!baseline || !candidate || !outDir) {
  console.error('usage: diff-screens.mjs <baselineDir> <candidateDir> <outDir> [--threshold 0.1]')
  process.exit(2)
}
const thresholdIndex = rest.indexOf('--threshold')
const threshold = thresholdIndex === -1 ? 0.1 : Number(rest[thresholdIndex + 1])
mkdirSync(outDir, { recursive: true })

const results = []
for (const name of readdirSync(baseline)
  .filter(file => file.endsWith('.png'))
  .sort()) {
  const other = join(candidate, name)
  if (!existsSync(other)) {
    results.push({ name, error: 'missing in candidate' })
    continue
  }
  const a = PNG.sync.read(readFileSync(join(baseline, name)))
  const b = PNG.sync.read(readFileSync(other))
  if (a.width !== b.width || a.height !== b.height) {
    results.push({ name, error: `size differs ${a.width}x${a.height} vs ${b.width}x${b.height}` })
    continue
  }
  const diff = new PNG({ width: a.width, height: a.height })
  const mismatched = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold })
  writeFileSync(join(outDir, `diff-${name}`), PNG.sync.write(diff))
  results.push({
    name,
    mismatchedPixels: mismatched,
    mismatchPercent: (100 * mismatched) / (a.width * a.height),
  })
}
writeFileSync(
  join(outDir, 'diff.json'),
  JSON.stringify({ baseline, candidate, threshold, results }, null, 2)
)
for (const r of results)
  console.log(
    r.error ? `${r.name}: ${r.error}` : `${r.name}: ${r.mismatchPercent.toFixed(2)}% differ`
  )
