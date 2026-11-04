// SPIKE: pure conversion of a fixture source (the data shapes the WebView path consumes) into
// the RenderDocument every benchmarked renderer draws. Reuses the DOM's own helpers so the text
// layout, the paragraph rules and the word tokenization are the ones BibleDOM uses.
import type { Verse } from '~common/types'
import { buildInterlinearVerseLayout } from '~helpers/interlinearVerseLayout'
import { tokenizeVerseText, type WordToken } from '~helpers/wordTokenizer'
import type { HighlightsObj } from '~redux/modules/user'
import type { WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'
import defaultColors from '~themes/colors'
import {
  buildCanonicalVersePresentation,
  shouldInsertCanonicalParagraphBreak,
  type CanonicalVersePresentationNode,
} from '~features/bible/BibleDOM/canonicalVersePresentation'
import { getBibleTextFontSize } from '~features/bible/BibleDOM/verseTypography'
import { scaleLineHeight } from '~features/bible/BibleDOM/scaleLineHeight'
import type {
  Block,
  Decoration,
  FixtureId,
  InterlinearBlock,
  ParagraphBlock,
  ParallelBlock,
  ReaderSettings,
  RenderDocument,
  Run,
  RunStyle,
} from '../contract'
import { RENDER_DOCUMENT_VERSION } from '../contract'

export type FixtureSource = {
  fixture: FixtureId
  version: string
  book: number
  chapter: number
  textRevision?: string
  verses: Verse[]
  parallelVersions?: { id: string; textRevision?: string; verses: Verse[] }[]
  interlinearMode?: 'strong' | 'interlinear'
  interlinearLocale?: string
  highlights?: HighlightsObj
  wordAnnotations?: WordAnnotationsObj
}

const parsePx = (value: string) => Number.parseFloat(value)

const BODY_FONT_SIZE_PX = parsePx(getBibleTextFontSize(0)) // 19, fontSizeScale 0 is the default
const BODY_LINE_HEIGHT_PX = parsePx(scaleLineHeight(32, 'normal', 0)) // 'normal' is the default
const VERSE_NUMBER_FONT_SIZE_PX = 14 // NumberText in BibleDOM/Verse.tsx
const STRONG_MARKER_FONT_SIZE_PX = 11
const VERSE_HIGHLIGHT_OPACITY = 0.9 // HIGHLIGHT_BACKGROUND_OPACITY / 100 in helpers/highlightUtils.ts
const RED_WORDS_LIGHT = '#CC0000' // getRedColor in BibleDOM/Verse.tsx

const toHex = (value: string, over = '#ffffff'): string => {
  const hex = value.trim()
  if (/^#[0-9a-f]{6}$/iu.test(hex)) return hex.toUpperCase()
  const rgb = /^rgba?\(([^)]+)\)$/iu.exec(hex)
  if (!rgb) return over
  const [r, g, b, a = '1'] = rgb[1].split(',').map(part => part.trim())
  const alpha = Number(a)
  const base = [1, 3, 5].map(index => Number.parseInt(over.slice(index, index + 2), 16))
  const mixed = [r, g, b].map((channel, index) =>
    Math.round(Number(channel) * alpha + base[index] * (1 - alpha))
  )
  return `#${mixed.map(channel => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

// The app's default reading settings: 'default' theme, fontSizeScale 0, lineHeight 'normal',
// textDisplay 'inline', fontFamily 'Avenir' (redux/modules/user.ts getInitialState).
export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: {
    background: toHex(defaultColors.reverse),
    text: toHex(defaultColors.default),
    secondaryText: toHex(defaultColors.darkGrey),
    verseNumber: toHex(defaultColors.darkGrey),
    redWords: RED_WORDS_LIGHT,
    accent: toHex(defaultColors.primary),
    selection: toHex(defaultColors.lightPrimary),
  },
  fontFamily: 'Avenir',
  fontSizePx: BODY_FONT_SIZE_PX,
  lineHeight: BODY_LINE_HEIGHT_PX / BODY_FONT_SIZE_PX,
  paragraphSpacingPx: 10,
  horizontalPaddingPx: 15,
  textDisplay: 'inline',
}

const verseKeyOf = (verse: Verse) => `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`

type Segment = { breakBefore: boolean; runs: Run[] }

const mergeStyle = (base: RunStyle, tag: string): RunStyle => {
  switch (tag.toLocaleLowerCase()) {
    case 'red-word':
      return { ...base, color: 'redWords' }
    case 'i':
    case 'em':
      return { ...base, italic: true }
    case 'b':
    case 'strong':
      return { ...base, weight: 700 }
    default:
      return base
  }
}

// Runs of one verse (without its number), split on the DOM annotation tokenizer's tokens.
const buildVerseSegments = (
  verse: Verse,
  textDisplay: ReaderSettings['textDisplay'],
  withStrongMarkers: boolean
): Segment[] => {
  const text = verse.Texte
  const verseKey = verseKeyOf(verse)
  const tokens = tokenizeVerseText(text)
  const nodes = buildCanonicalVersePresentation({
    text,
    startTags: verse.StartTags,
    layout: verse.Layout,
    notes: [],
    strongSpans: withStrongMarkers ? verse.StrongSpans : [],
  })

  const segments: Segment[] = [{ breakBefore: false, runs: [] }]
  let cursor = 0

  const pushText = (length: number, style: RunStyle) => {
    const from = cursor
    const to = cursor + length
    cursor = to
    const runs = segments[segments.length - 1].runs
    for (const token of tokens as WordToken[]) {
      const start = Math.max(token.charStart, from)
      const end = Math.min(token.charEnd, to)
      if (end <= start) continue
      runs.push({
        text: text.slice(start, end),
        style,
        role: token.isWhitespace ? 'space' : 'word',
        verseKey,
        ...(token.isWhitespace ? {} : { wordIndex: token.index }),
      })
    }
  }

  const walk = (children: CanonicalVersePresentationNode[], style: RunStyle) => {
    for (const node of children) {
      switch (node.kind) {
        case 'text':
          pushText(node.text.length, style)
          break
        case 'strong-reference': {
          const code = node.identities[0]?.code
          if (!code) break
          segments[segments.length - 1].runs.push({
            text: code,
            style: {
              color: 'accent',
              sizeScale: STRONG_MARKER_FONT_SIZE_PX / BODY_FONT_SIZE_PX,
              superscript: true,
            },
            role: 'strongMarker',
            verseKey,
            strong: code,
          })
          break
        }
        case 'paragraph-start':
          if (
            shouldInsertCanonicalParagraphBreak({
              offset: node.offset,
              verse: verse.Verset,
              textDisplay,
            })
          ) {
            segments.push({ breakBefore: true, runs: [] })
          }
          break
        case 'line-start':
          segments[segments.length - 1].runs.push({
            text: '\n',
            style: {},
            role: 'space',
            verseKey,
          })
          break
        case 'note-reference':
          break
        case 'element':
          walk(node.children, mergeStyle(style, node.tag))
          break
      }
    }
  }
  walk(nodes, {})
  return segments
}

const verseNumberRuns = (verse: Verse, withSpace = true): Run[] => [
  {
    text: String(verse.Verset),
    style: { color: 'verseNumber', sizeScale: VERSE_NUMBER_FONT_SIZE_PX / BODY_FONT_SIZE_PX },
    role: 'verseNumber',
    verseKey: verseKeyOf(verse),
  },
  ...(withSpace
    ? [{ text: ' ', style: {}, role: 'space' as const, verseKey: verseKeyOf(verse) }]
    : []),
]

const runsLength = (runs: Run[]) => runs.reduce((sum, run) => sum + run.text.length, 0)

const verseHeadingTexts = (verse: Verse) =>
  (verse.Headings ?? []).filter(heading => heading.offset === 0).map(heading => heading.text)

const resolveColor = (colorId: string, source: FixtureSource): string => {
  const themeColors = defaultColors as Record<string, string>
  return toHex(themeColors[colorId] ?? colorId)
}

const wordsRange = (runs: Run[], verseKey: string, startWord: number, endWord: number) => {
  let offset = 0
  let start = -1
  let end = -1
  for (const run of runs) {
    if (run.verseKey === verseKey && run.wordIndex !== undefined) {
      if (run.wordIndex >= startWord && run.wordIndex <= endWord) {
        if (start === -1) start = offset
        end = offset + run.text.length
      }
    }
    offset += run.text.length
  }
  return start === -1 ? undefined : { start, end }
}

const verseRange = (runs: Run[], verseKey: string) => {
  let offset = 0
  let start = -1
  let end = -1
  for (const run of runs) {
    if (run.verseKey === verseKey && run.role !== 'space') {
      if (start === -1) start = offset
      end = offset + run.text.length
    }
    offset += run.text.length
  }
  return start === -1 ? undefined : { start, end }
}

const buildDecorations = (runs: Run[], source: FixtureSource): Decoration[] => {
  const decorations: Decoration[] = []
  const verseKeys = new Set(runs.flatMap(run => (run.verseKey ? [run.verseKey] : [])))
  for (const verseKey of verseKeys) {
    const highlight = source.highlights?.[verseKey]
    const range = highlight && verseRange(runs, verseKey)
    if (highlight && range) {
      decorations.push({
        kind: 'verseHighlight',
        ...range,
        color: resolveColor(highlight.color, source),
        opacity: VERSE_HIGHLIGHT_OPACITY,
      })
    }
  }
  for (const annotation of Object.values(source.wordAnnotations ?? {})) {
    if (annotation.version !== source.version) continue
    for (const range of annotation.ranges) {
      const found = wordsRange(runs, range.verseKey, range.startWordIndex, range.endWordIndex)
      if (!found) continue
      decorations.push({
        kind: annotation.type,
        ...found,
        color: resolveColor(annotation.color, source),
        ...(annotation.type === 'background' ? { opacity: 0.5 } : {}),
      })
    }
  }
  return decorations
}

const buildParagraphs = (source: FixtureSource, settings: ReaderSettings): Block[] => {
  const blocks: Block[] = []
  const dir = source.version === 'BHG' ? 'rtl' : 'ltr'
  const withStrong = source.interlinearMode === 'strong'
  let runs: Run[] = []
  let paragraphCount = 0
  let titleCount = 0

  const flush = () => {
    if (!runs.length) return
    blocks.push({
      kind: 'paragraph',
      id: `p${paragraphCount++}`,
      dir,
      runs,
      decorations: buildDecorations(runs, source),
    } satisfies ParagraphBlock)
    runs = []
  }

  for (const verse of source.verses) {
    for (const text of verseHeadingTexts(verse)) {
      flush()
      blocks.push({ kind: 'title', id: `t${titleCount++}`, text, level: 2 })
    }
    if (settings.textDisplay === 'block') flush()
    const segments = buildVerseSegments(verse, settings.textDisplay, withStrong)
    segments.forEach((segment, index) => {
      if (segment.breakBefore) flush()
      if (index === 0) runs.push(...verseNumberRuns(verse))
      runs.push(...segment.runs)
    })
    runs.push({ text: ' ', style: {}, role: 'space', verseKey: verseKeyOf(verse) })
  }
  flush()
  return blocks
}

const buildInterlinear = (source: FixtureSource): Block[] =>
  source.verses.map(verse => {
    const tokens = tokenizeVerseText(verse.Texte)
    const layout = buildInterlinearVerseLayout(verse.Texte, verse.InterlinearTokens ?? [])
    const words = layout.pieces.map(({ surface, token }, index) => {
      const containing = tokens.find(
        candidate => !candidate.isWhitespace && candidate.charEnd > token.startOffset
      )
      const identities = token.segments.flatMap(segment => segment.identities)
      return {
        wordIndex: containing?.index ?? index,
        original: surface,
        transliteration: token.segments
          .map(segment => segment.transliteration)
          .filter(Boolean)
          .join(' · '),
        gloss: token.segments
          .map(segment => segment.gloss)
          .filter(Boolean)
          .join(' · '),
        ...(identities[0] ? { strong: identities[0].code } : {}),
      }
    })
    return {
      kind: 'interlinear',
      id: `i${verse.Verset}`,
      verseKey: verseKeyOf(verse),
      dir: source.version === 'BHG' ? 'rtl' : 'ltr',
      words,
    } satisfies InterlinearBlock
  })

const buildParallel = (source: FixtureSource, settings: ReaderSettings): Block[] => {
  const versions = [
    { id: source.version, verses: source.verses },
    ...(source.parallelVersions ?? []),
  ]
  const numbers = [
    ...new Set(versions.flatMap(version => version.verses.map(v => Number(v.Verset)))),
  ].sort((a, b) => a - b)
  const blocks: Block[] = []
  let titleCount = 0
  for (const number of numbers) {
    const main = source.verses.find(verse => Number(verse.Verset) === number)
    for (const text of main ? verseHeadingTexts(main) : []) {
      blocks.push({ kind: 'title', id: `t${titleCount++}`, text, level: 2 })
    }
    blocks.push({
      kind: 'parallel',
      id: `r${number}`,
      verseKey: `${source.book}-${source.chapter}-${number}`,
      columns: versions.map(version => {
        const verse = version.verses.find(candidate => Number(candidate.Verset) === number)
        const runs = verse
          ? [
              ...verseNumberRuns(verse),
              ...buildVerseSegments(verse, settings.textDisplay, false).flatMap(s => s.runs),
            ]
          : []
        return { versionId: version.id, dir: 'ltr' as const, runs, decorations: [] }
      }),
    } satisfies ParallelBlock)
  }
  return blocks
}

export const toRenderDocument = (
  source: FixtureSource,
  settings: ReaderSettings = DEFAULT_READER_SETTINGS
): RenderDocument => ({
  version: RENDER_DOCUMENT_VERSION,
  fixture: source.fixture,
  settings,
  blocks:
    source.fixture === 'genesis1-bhg-interlinear'
      ? buildInterlinear(source)
      : source.fixture === 'john1-parallel'
        ? buildParallel(source, settings)
        : buildParagraphs(source, settings),
})

export { runsLength }
