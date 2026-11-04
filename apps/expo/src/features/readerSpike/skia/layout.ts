// SPIKE: throwaway. All layout for the Skia reader PoC: RenderDocument -> laid out blocks -> rows.
// Pure TypeScript on top of Skia.ParagraphBuilder, so it stays OTA-updatable.
import {
  FontSlant,
  Skia,
  TextAlign,
  TextDirection,
  TextHeightBehavior,
  type SkParagraph,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia'

import type {
  Block,
  Decoration,
  InterlinearBlock,
  ParagraphBlock,
  ParallelBlock,
  ReaderSettings,
  ReaderTheme,
  Run,
  RunStyle,
} from '../contract'

export const SLICE_TARGET_PX = 700
export const BUNDLED_FONT_FAMILY = 'Literata Book'

export type Word = {
  start: number
  end: number
  verseKey: string
  wordIndex: number
  /** Global, document-order index across every selectable paragraph. */
  g: number
}

export type RunMeta = { start: number; end: number; verseKey?: string; role: Run['role'] }

export type Unit = {
  para: SkParagraph
  text: string
  x: number
  y: number
  width: number
  height: number
  dir: 'ltr' | 'rtl'
  runs: RunMeta[]
  words: Word[]
  decorations: Decoration[]
  /** Line start/end offsets, used for slicing and accessibility labels. */
  lines: { start: number; end: number; top: number; bottom: number }[]
  selectable: boolean
}

export type Cell = {
  x: number
  y: number
  width: number
  height: number
  paras: { para: SkParagraph; y: number }[]
  verseKey: string
  wordIndex?: number
  label: string
}

export type RowPlan = {
  key: string
  blockIdx: number
  sliceIdx: number
  /** Absolute y of the row in the list content. */
  top: number
  /** Y of the row's first pixel in block coordinates. */
  blockY0: number
  height: number
  label: string
}

export type BlockLayout = {
  block: Block
  idx: number
  height: number
  units: Unit[]
  cells: Cell[]
  /** Block y -> bottom of block padding etc. Rows are computed per block, tops fixed up later. */
  rows: RowPlan[]
  buildMs: number
  layoutMs: number
  textLength: number
}

export type DocumentLayout = {
  width: number
  theme: ReaderTheme
  blocks: BlockLayout[]
  rows: RowPlan[]
  totalHeight: number
  wordCount: number
  /** [blockIdx] -> [firstG, lastG] for selectable blocks. */
  blockWordRange: ([number, number] | null)[]
  words: { blockIdx: number; unitIdx: number; word: Word }[]
  stats: LayoutStats
}

export type LayoutStats = {
  blocks: number
  rows: number
  textChars: number
  minMs: number
  avgMs: number
  maxMs: number
  totalMs: number
  buildMs: number
  layoutMs: number
  cachedBlocks: number
}

const color = (hex: string) => Skia.Color(hex)

const resolveFamilies = (settings: ReaderSettings): string[] =>
  settings.fontFamily === 'Literata' || settings.fontFamily === BUNDLED_FONT_FAMILY
    ? [BUNDLED_FONT_FAMILY]
    : // Anything else (e.g. 'Avenir', not bundled) is a system font in the WebView; on Android
      // that resolves to the platform default, which is what an empty family list gives.
      []

type Env = {
  settings: ReaderSettings
  provider: SkTypefaceFontProvider
  families: string[]
}

const styleKey = (s: RunStyle) =>
  `${s.color ?? ''}|${s.weight ?? ''}|${s.italic ? 'i' : ''}|${s.sizeScale ?? ''}`

type BuildOpts = {
  baseSize: number
  lineHeight: number
  align?: TextAlign
  weight?: number
  colorKey?: keyof ReaderTheme
  maxLines?: number
}

const buildParagraph = (
  env: Env,
  runs: Run[] | { text: string; style: RunStyle }[],
  dir: 'ltr' | 'rtl',
  opts: BuildOpts
): SkParagraph => {
  const { settings, provider, families } = env
  const builder = Skia.ParagraphBuilder.Make(
    {
      textDirection: dir === 'rtl' ? TextDirection.RTL : TextDirection.LTR,
      textAlign: opts.align ?? TextAlign.Start,
      textHeightBehavior: TextHeightBehavior.All,
      maxLines: opts.maxLines,
      strutStyle: {
        strutEnabled: true,
        fontFamilies: families,
        fontSize: opts.baseSize,
        heightMultiplier: opts.lineHeight,
        halfLeading: true,
        forceStrutHeight: true,
      },
    },
    provider
  )

  // Coalesce neighbouring runs with the same style: Psalm 119 has 5k runs, but the paragraph
  // only needs one style push per visual change (word/space/word... share one style).
  let i = 0
  while (i < runs.length) {
    const style = runs[i].style
    const key = styleKey(style)
    let text = runs[i].text
    let j = i + 1
    while (j < runs.length && styleKey(runs[j].style) === key) {
      text += runs[j].text
      j++
    }
    const colorKey = style.color ?? opts.colorKey ?? 'text'
    const weight = style.weight ?? opts.weight ?? 400
    builder.pushStyle({
      color: color(settings.theme[colorKey]),
      fontSize: opts.baseSize * (style.sizeScale ?? 1),
      fontFamilies: families,
      fontStyle: {
        weight,
        slant: style.italic ? FontSlant.Italic : FontSlant.Upright,
      },
      heightMultiplier: opts.lineHeight,
      halfLeading: true,
    })
    builder.addText(text)
    builder.pop()
    i = j
  }
  return builder.build()
}

const makeUnit = (
  env: Env,
  runs: Run[],
  dir: 'ltr' | 'rtl',
  decorations: Decoration[],
  x: number,
  width: number,
  opts: { baseSize?: number; weight?: number; selectable: boolean; lineHeight?: number },
  timing: { build: number; layout: number }
): Unit => {
  const { settings } = env
  const t0 = performance.now()
  const para = buildParagraph(env, runs, dir, {
    baseSize: opts.baseSize ?? settings.fontSizePx,
    lineHeight: opts.lineHeight ?? settings.lineHeight,
    weight: opts.weight,
  })
  const t1 = performance.now()
  para.layout(width)
  const t2 = performance.now()
  timing.build += t1 - t0
  timing.layout += t2 - t1

  const metas: RunMeta[] = []
  const words: Word[] = []
  let off = 0
  let text = ''
  for (const r of runs) {
    metas.push({ start: off, end: off + r.text.length, verseKey: r.verseKey, role: r.role })
    if (r.role === 'word' && r.verseKey !== undefined && r.wordIndex !== undefined) {
      words.push({
        start: off,
        end: off + r.text.length,
        verseKey: r.verseKey,
        wordIndex: r.wordIndex,
        g: -1,
      })
    }
    off += r.text.length
    text += r.text
  }
  const lines = para.getLineMetrics().map(lm => {
    const top = lm.baseline - lm.ascent
    return { start: lm.startIndex, end: lm.endIndex, top, bottom: top + lm.height }
  })
  return {
    para,
    text,
    x,
    y: 0,
    width,
    height: para.getHeight(),
    dir,
    runs: metas,
    words,
    decorations,
    lines,
    selectable: opts.selectable,
  }
}

const plain = (runs: Run[]) => runs.map(r => r.text).join('')

type BlockResult = Omit<BlockLayout, 'idx' | 'rows'> & {
  /** Slice boundaries in block coordinates; first is 0, last is height. */
  cuts: number[]
  sliceLabels: string[]
}

const layoutTitle = (block: Extract<Block, { kind: 'title' }>, width: number, env: Env) => {
  const { settings } = env
  const timing = { build: 0, layout: 0 }
  const pad = settings.horizontalPaddingPx
  const size = settings.fontSizePx * (block.level === 1 ? 1.5 : 1.25)
  const unit = makeUnit(
    env,
    [{ text: block.text, style: { weight: 700 }, role: 'word' }],
    'ltr',
    [],
    pad,
    width - pad * 2,
    { baseSize: size, selectable: false, lineHeight: 1.3 },
    timing
  )
  const padTop = settings.paragraphSpacingPx * 1.5
  unit.y = padTop
  const height = padTop + unit.height + settings.paragraphSpacingPx * 0.5
  return {
    block,
    height,
    units: [unit],
    cells: [],
    buildMs: timing.build,
    layoutMs: timing.layout,
    textLength: block.text.length,
    cuts: [0, height],
    sliceLabels: [block.text],
  } satisfies BlockResult
}

const sliceUnit = (unit: Unit, padTop: number, height: number) => {
  const cuts = [0]
  const labels: string[] = []
  let sliceStartLine = 0
  let sliceStartY = 0
  for (let i = 0; i < unit.lines.length; i++) {
    const line = unit.lines[i]
    const lineTop = padTop + line.top
    if (i > sliceStartLine && lineTop + (line.bottom - line.top) - sliceStartY > SLICE_TARGET_PX) {
      cuts.push(lineTop)
      labels.push(unit.text.slice(unit.lines[sliceStartLine].start, unit.lines[i - 1].end))
      sliceStartLine = i
      sliceStartY = lineTop
    }
  }
  const first = unit.lines[sliceStartLine]?.start ?? 0
  labels.push(unit.text.slice(first))
  cuts.push(height)
  return { cuts, labels }
}

const layoutParagraph = (block: ParagraphBlock, width: number, env: Env) => {
  const { settings } = env
  const timing = { build: 0, layout: 0 }
  const pad = settings.horizontalPaddingPx
  const unit = makeUnit(
    env,
    block.runs,
    block.dir,
    block.decorations,
    pad,
    width - pad * 2,
    { selectable: true },
    timing
  )
  const padTop = 4
  unit.y = padTop
  const height = padTop + unit.height + settings.paragraphSpacingPx
  const { cuts, labels } = sliceUnit(unit, padTop, height)
  return {
    block,
    height,
    units: [unit],
    cells: [],
    buildMs: timing.build,
    layoutMs: timing.layout,
    textLength: unit.text.length,
    cuts,
    sliceLabels: labels,
  } satisfies BlockResult
}

const layoutParallel = (block: ParallelBlock, width: number, env: Env) => {
  const { settings } = env
  const timing = { build: 0, layout: 0 }
  const pad = settings.horizontalPaddingPx
  const gap = 14
  const n = block.columns.length
  const colW = (width - pad * 2 - gap * (n - 1)) / n
  const padTop = 4
  const units = block.columns.map((col, i) => {
    const u = makeUnit(
      env,
      col.runs,
      col.dir,
      col.decorations,
      pad + i * (colW + gap),
      colW,
      { selectable: false },
      timing
    )
    u.y = padTop
    return u
  })
  const height = padTop + Math.max(...units.map(u => u.height)) + settings.paragraphSpacingPx
  const label = block.columns
    .map((c, i) => `${c.versionId}: ${units[i].text}`)
    .join('. ')
  return {
    block,
    height,
    units,
    cells: [],
    buildMs: timing.build,
    layoutMs: timing.layout,
    textLength: units.reduce((a, u) => a + u.text.length, 0),
    cuts: [0, height],
    sliceLabels: [label],
  } satisfies BlockResult
}

const measureOneLine = (env: Env, text: string, dir: 'ltr' | 'rtl', opts: BuildOpts) => {
  const para = buildParagraph(env, [{ text, style: {} }], dir, { ...opts, maxLines: 1 })
  para.layout(2000)
  return para
}

const layoutInterlinear = (block: InterlinearBlock, width: number, env: Env) => {
  const { settings } = env
  const timing = { build: 0, layout: 0 }
  const t0 = performance.now()
  const pad = settings.horizontalPaddingPx
  const avail = width - pad * 2
  const base = settings.fontSizePx
  const rtl = block.dir === 'rtl'
  const tiers: { key: 'original' | 'transliteration' | 'gloss' | 'strong'; size: number; color: keyof ReaderTheme; dir: 'ltr' | 'rtl' }[] = [
    { key: 'original', size: base * 1.25, color: 'text', dir: block.dir },
    { key: 'transliteration', size: base * 0.62, color: 'secondaryText', dir: 'ltr' },
    { key: 'gloss', size: base * 0.68, color: 'text', dir: 'ltr' },
    { key: 'strong', size: base * 0.58, color: 'accent', dir: 'ltr' },
  ]

  type Proto = { label: string; wordIndex?: number; items: { text: string; tier: (typeof tiers)[number]; para: SkParagraph; w: number; h: number }[] }
  const protos: Proto[] = []
  const verseNum = block.verseKey.split('-').pop() ?? ''
  const mk = (text: string, tier: (typeof tiers)[number], bold = false) => {
    const para = measureOneLine(env, text, tier.dir, {
      baseSize: tier.size,
      lineHeight: 1.25,
      colorKey: tier.color,
      weight: bold ? 700 : 400,
      align: TextAlign.Center,
    })
    return { text, tier, para, w: Math.ceil(para.getLongestLine()) + 1, h: para.getHeight() }
  }
  protos.push({ label: `verse ${verseNum}`, items: [mk(verseNum, tiers[2], true)] })
  for (const w of block.words) {
    const items = tiers
      .map(t => {
        const text = w[t.key]
        return text ? mk(text, t) : null
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
    protos.push({
      label: [w.original, w.transliteration, w.gloss].filter(Boolean).join(' '),
      wordIndex: w.wordIndex,
      items,
    })
  }
  timing.build += performance.now() - t0

  const t1 = performance.now()
  const gapX = 12
  const gapY = 12
  const padTop = 6
  type Placed = { proto: Proto; w: number; h: number }
  const lines: Placed[][] = [[]]
  let used = 0
  for (const p of protos) {
    const w = Math.max(...p.items.map(i => i.w)) + 4
    const h = p.items.reduce((a, i) => a + i.h, 0)
    const need = (lines[lines.length - 1].length ? gapX : 0) + w
    if (used + need > avail && lines[lines.length - 1].length) {
      lines.push([])
      used = 0
    }
    lines[lines.length - 1].push({ proto: p, w, h })
    used += (lines[lines.length - 1].length > 1 ? gapX : 0) + w
  }
  const cells: Cell[] = []
  let y = padTop
  for (const line of lines) {
    const lineH = Math.max(...line.map(c => c.h))
    let cursor = 0
    for (const c of line) {
      const x = rtl ? width - pad - cursor - c.w : pad + cursor
      cursor += c.w + gapX
      // Re-lay out each tier at the cell width so TextAlign.Center centres it in the stack.
      let py = 0
      const paras = c.proto.items.map(item => {
        item.para.layout(c.w)
        const out = { para: item.para, y: py }
        py += item.h
        return out
      })
      cells.push({
        x,
        y,
        width: c.w,
        height: c.h,
        paras,
        verseKey: block.verseKey,
        wordIndex: c.proto.wordIndex,
        label: c.proto.label,
      })
    }
    y += lineH + gapY
  }
  timing.layout += performance.now() - t1
  const height = y + settings.paragraphSpacingPx * 0.5
  const textLength = block.words.reduce((a, w) => a + w.original.length, 0)
  return {
    block,
    height,
    units: [],
    cells,
    buildMs: timing.build,
    layoutMs: timing.layout,
    textLength,
    cuts: [0, height],
    sliceLabels: [
      `Verse ${verseNum}. ` +
        block.words.map(w => [w.original, w.gloss].filter(Boolean).join(' ')).join(', '),
    ],
  } satisfies BlockResult
}

const blockCache = new WeakMap<Block, Map<string, BlockResult>>()

const settingsKey = (s: ReaderSettings) =>
  [s.fontFamily, s.fontSizePx, s.lineHeight, s.paragraphSpacingPx, s.horizontalPaddingPx, s.textDisplay].join('|')

const layoutBlock = (block: Block, width: number, env: Env): { result: BlockResult; cached: boolean } => {
  const key = `${width}|${settingsKey(env.settings)}`
  let perBlock = blockCache.get(block)
  if (!perBlock) {
    perBlock = new Map()
    blockCache.set(block, perBlock)
  }
  const hit = perBlock.get(key)
  if (hit) return { result: hit, cached: true }
  let result: BlockResult
  switch (block.kind) {
    case 'title':
      result = layoutTitle(block, width, env)
      break
    case 'paragraph':
      result = layoutParagraph(block, width, env)
      break
    case 'parallel':
      result = layoutParallel(block, width, env)
      break
    case 'interlinear':
      result = layoutInterlinear(block, width, env)
      break
  }
  perBlock.set(key, result)
  return { result, cached: false }
}

export const layoutDocument = (
  blocks: Block[],
  width: number,
  settings: ReaderSettings,
  provider: SkTypefaceFontProvider
): DocumentLayout => {
  const env: Env = { settings, provider, families: resolveFamilies(settings) }
  const laid: BlockLayout[] = []
  const rows: RowPlan[] = []
  const words: DocumentLayout['words'] = []
  const blockWordRange: DocumentLayout['blockWordRange'] = []
  const perBlockMs: number[] = []
  let top = 0
  let buildMs = 0
  let layoutMs = 0
  let textChars = 0
  let g = 0
  let cachedBlocks = 0
  const tStart = performance.now()
  blocks.forEach((block, idx) => {
    const t0 = performance.now()
    const { result, cached } = layoutBlock(block, width, env)
    if (cached) cachedBlocks++
    else {
      perBlockMs.push(performance.now() - t0)
      buildMs += result.buildMs
      layoutMs += result.layoutMs
    }
    textChars += result.textLength
    // Word ids are assigned per document so cached block layouts can be reused in any order.
    let first = -1
    result.units.forEach((unit, unitIdx) => {
      if (!unit.selectable) return
      for (const w of unit.words) {
        w.g = g++
        if (first < 0) first = w.g
        words.push({ blockIdx: idx, unitIdx, word: w })
      }
    })
    blockWordRange.push(first >= 0 ? [first, g - 1] : null)
    const blockRows: RowPlan[] = []
    for (let s = 0; s < result.cuts.length - 1; s++) {
      const row: RowPlan = {
        key: `${block.id}:${s}`,
        blockIdx: idx,
        sliceIdx: s,
        top: top + result.cuts[s],
        blockY0: result.cuts[s],
        height: result.cuts[s + 1] - result.cuts[s],
        label: result.sliceLabels[s],
      }
      blockRows.push(row)
      rows.push(row)
    }
    laid.push({ ...result, idx, rows: blockRows })
    top += result.height
  })
  const totalMs = performance.now() - tStart
  const times = perBlockMs.length ? perBlockMs : [0]
  return {
    width,
    theme: settings.theme,
    blocks: laid,
    rows,
    totalHeight: top,
    wordCount: g,
    blockWordRange,
    words,
    stats: {
      blocks: blocks.length,
      rows: rows.length,
      textChars,
      minMs: Math.min(...times),
      avgMs: times.reduce((a, b) => a + b, 0) / times.length,
      maxMs: Math.max(...times),
      totalMs,
      buildMs,
      layoutMs,
      cachedBlocks,
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Hit testing

export type Hit = {
  verseKey: string
  wordIndex?: number
  unitIdx?: number
  word?: Word
  /** Unit-local char offset when the hit was in a text unit. */
  offset?: number
}

const wordAt = (unit: Unit, off: number): Word | undefined => {
  const ws = unit.words
  let lo = 0
  let hi = ws.length - 1
  let best = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (ws[mid].start <= off) {
      best = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return best >= 0 ? ws[best] : undefined
}

const runAt = (unit: Unit, off: number): RunMeta | undefined => {
  const rs = unit.runs
  let lo = 0
  let hi = rs.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (off < rs[mid].start) hi = mid - 1
    else if (off >= rs[mid].end) lo = mid + 1
    else return rs[mid]
  }
  return rs[rs.length - 1]
}

const rectContains = (r: { x: number; y: number; width: number; height: number }, x: number, y: number, tol: number) =>
  x >= r.x - tol && x <= r.x + r.width + tol && y >= r.y - tol && y <= r.y + r.height + tol

/** Hit test in block coordinates. Returns the verse (and word, when the tap landed on glyphs). */
export const hitTestBlock = (b: BlockLayout, x: number, y: number): Hit | null => {
  for (let ui = 0; ui < b.units.length; ui++) {
    const u = b.units[ui]
    const lx = x - u.x
    const ly = y - u.y
    if (lx < 0 || ly < 0 || lx > u.width || ly > u.height) continue
    const off = u.para.getGlyphPositionAtCoordinate(lx, ly)
    // The paragraph answers with the nearest glyph boundary even for taps in blank space, and
    // the boundary can be the first glyph of the next word. Accept a word only when the point
    // is actually inside its rectangles.
    const cands: (Word | undefined)[] = [wordAt(u, off), wordAt(u, off - 1)]
    for (const w of cands) {
      if (!w || off > w.end || off < w.start) continue
      if (u.para.getRectsForRange(w.start, w.end).some(r => rectContains(r, lx, ly, 3))) {
        return { verseKey: w.verseKey, wordIndex: w.wordIndex, unitIdx: ui, word: w, offset: off }
      }
    }
    const run = runAt(u, Math.min(off, u.text.length - 1))
    if (run?.verseKey) return { verseKey: run.verseKey, unitIdx: ui, offset: off }
    return null
  }
  for (const c of b.cells) {
    if (rectContains(c, x, y, 2)) return { verseKey: c.verseKey, wordIndex: c.wordIndex }
  }
  return null
}

/** Nearest selectable word to a block-space point (used while dragging a selection). */
export const nearestWord = (b: BlockLayout, x: number, y: number): { unitIdx: number; word: Word } | null => {
  let best: { unitIdx: number; word: Word } | null = null
  b.units.forEach((u, unitIdx) => {
    if (!u.selectable || !u.words.length) return
    if (best) return
    const ly = Math.min(Math.max(y - u.y, 0), u.height - 1)
    const lx = Math.min(Math.max(x - u.x, 0), u.width - 1)
    const off = u.para.getGlyphPositionAtCoordinate(lx, ly)
    const w = wordAt(u, off) ?? u.words[0]
    const next = u.words[u.words.indexOf(w) + 1]
    const pick = next && off - w.end > next.start - off ? next : w
    best = { unitIdx, word: pick }
  })
  return best
}

export const unitWordRects = (u: Unit, w: Word) => u.para.getRectsForRange(w.start, w.end)

/** Block-space y of the first line of a verse, for scrollToVerse. */
export const verseYInBlock = (b: BlockLayout, verseKey: string): number | null => {
  if (b.block.kind === 'interlinear' || b.block.kind === 'parallel') {
    return b.block.verseKey === verseKey ? 0 : null
  }
  for (const u of b.units) {
    const run = u.runs.find(r => r.verseKey === verseKey)
    if (run) {
      const rect = u.para.getRectsForRange(run.start, Math.max(run.end, run.start + 1))[0]
      return u.y + (rect ? rect.y : 0)
    }
  }
  return null
}

export const documentPlainText = (b: Block): string => {
  switch (b.kind) {
    case 'title':
      return b.text
    case 'paragraph':
      return plain(b.runs)
    case 'parallel':
      return b.columns.map(c => plain(c.runs)).join(' ')
    case 'interlinear':
      return b.words.map(w => w.original).join(' ')
  }
}
