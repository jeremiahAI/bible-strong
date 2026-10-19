// SPIKE: throwaway contract shared by the WebView baseline, the Kotlin Views PoC and the Skia PoC.
// Every renderer consumes the same RenderDocument and reports the same ReaderEvents, so the
// measurement harness can compare them on identical input.

export const RENDER_DOCUMENT_VERSION = 0

export type FixtureId =
  | 'psalm119'
  | 'john1-strong'
  | 'genesis1-bhg-interlinear'
  | 'john1-parallel'
  | 'romans8-annotated'

export type RendererId = 'webview' | 'views' | 'skia'

// Colors are resolved hex strings; the renderer never derives a theme on its own.
export type ReaderTheme = {
  background: string
  text: string
  secondaryText: string
  verseNumber: string
  redWords: string
  accent: string
  selection: string
}

export type ReaderSettings = {
  theme: ReaderTheme
  fontFamily: string // same font files the WebView loads, e.g. 'Literata'
  fontSizePx: number
  lineHeight: number // multiplier of fontSizePx
  paragraphSpacingPx: number
  horizontalPaddingPx: number
  textDisplay: 'inline' | 'block'
}

export type RunStyle = {
  color?: keyof ReaderTheme
  weight?: 400 | 600 | 700
  italic?: boolean
  sizeScale?: number // 1 = body size; verse numbers use < 1
  superscript?: boolean
}

// All offsets are UTF-16 code units into the concatenated text of a block's runs,
// which is what JS strings, java.lang.String and RN Skia's paragraph API all index by.
export type Run = {
  text: string
  style: RunStyle
  role: 'verseNumber' | 'word' | 'space' | 'punctuation' | 'strongMarker'
  verseKey?: string // `${book}-${chapter}-${verse}`, as in the existing BibleDOM
  wordIndex?: number // tokenization comes from TypeScript; renderers never re-tokenize
  strong?: string // e.g. 'G3056'
}

export type Decoration = {
  kind: 'verseHighlight' | 'background' | 'underline' | 'circle'
  start: number
  end: number
  color: string
}

export type TitleBlock = { kind: 'title'; id: string; text: string; level: 1 | 2 }

export type ParagraphBlock = {
  kind: 'paragraph'
  id: string
  dir: 'ltr' | 'rtl'
  runs: Run[]
  decorations: Decoration[]
}

export type InterlinearWord = {
  wordIndex: number
  original: string
  transliteration?: string
  gloss?: string
  strong?: string
}

export type InterlinearBlock = {
  kind: 'interlinear'
  id: string
  verseKey: string
  dir: 'ltr' | 'rtl'
  words: InterlinearWord[]
}

export type ParallelBlock = {
  kind: 'parallel'
  id: string
  verseKey: string
  columns: { versionId: string; dir: 'ltr' | 'rtl'; runs: Run[]; decorations: Decoration[] }[]
}

export type Block = TitleBlock | ParagraphBlock | InterlinearBlock | ParallelBlock

export type RenderDocument = {
  version: typeof RENDER_DOCUMENT_VERSION
  fixture: FixtureId
  settings: ReaderSettings
  blocks: Block[]
}

// Commands the bench screen sends to a mounted renderer.
export type ReaderCommand =
  | { type: 'scrollToVerse'; verseKey: string }
  | { type: 'setDecorations'; blockId: string; decorations: Decoration[] }

// Events every renderer must emit. `t` is wall-clock epoch ms on the device at the moment it
// happened: Date.now() in JS/DOM, System.currentTimeMillis() in Kotlin. One clock for everything,
// so the adb harness (`date +%s%3N` on the device) can line its inputs up with renderer events.
export type ReaderEvent =
  | { type: 'firstTextPainted'; t: number } // first frame with chapter text actually drawn
  | { type: 'verseTap'; verseKey: string; t: number }
  | { type: 'wordTap'; verseKey: string; wordIndex: number; t: number }
  | {
      type: 'selectionChanged'
      start: { verseKey: string; wordIndex: number }
      end: { verseKey: string; wordIndex: number }
      t: number
    }
  | { type: 'decorationsPainted'; blockId: string; t: number }
  | { type: 'scrolledToVerse'; verseKey: string; t: number }

// Props of a renderer component under src/features/readerSpike/<renderer>/.
// `command.seq` increases for every new command so repeated commands are not deduplicated.
export type ReaderProps = {
  document: RenderDocument
  command?: ReaderCommand & { seq: number; issuedAt: number }
  onEvent: (event: ReaderEvent) => void
}

// Every event is also logged as one line so the adb harness can read it from logcat:
//   READER_BENCH {"renderer":"skia","fixture":"psalm119","event":{...}}
export const BENCH_LOG_TAG = 'READER_BENCH'
