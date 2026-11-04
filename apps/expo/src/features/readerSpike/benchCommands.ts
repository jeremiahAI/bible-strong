// SPIKE: the fixed commands the bench screen's debug panel issues, identical for every renderer.
import type { Decoration, ReaderCommand, RenderDocument } from './contract'

const BENCH_HIGHLIGHT_COLOR = '#FFD54F'

// Highlights the first three words of the first twelve verses of the first paragraph block.
export const getBenchHighlightCommand = (
  document: RenderDocument
): Extract<ReaderCommand, { type: 'setDecorations' }> | undefined => {
  const block = document.blocks.find(candidate => candidate.kind === 'paragraph')
  if (block?.kind !== 'paragraph') return undefined
  const decorations: Decoration[] = []
  const seen = new Set<string>()
  let offset = 0
  let current: { verseKey: string; start: number; end: number } | undefined
  const flush = () => {
    if (current)
      decorations.push({
        kind: 'background',
        start: current.start,
        end: current.end,
        color: BENCH_HIGHLIGHT_COLOR,
        opacity: 0.5,
      })
    current = undefined
  }
  for (const run of block.runs) {
    const runEnd = offset + run.text.length
    if (
      run.role === 'word' &&
      run.verseKey &&
      run.wordIndex !== undefined &&
      run.wordIndex < 3 &&
      seen.size <= 12
    ) {
      if (current && current.verseKey !== run.verseKey) flush()
      if (!current) {
        if (seen.size >= 12) break
        seen.add(run.verseKey)
        current = { verseKey: run.verseKey, start: offset, end: runEnd }
      } else {
        current.end = runEnd
      }
    } else if (current && run.role !== 'space') {
      flush()
    }
    offset = runEnd
  }
  flush()
  return decorations.length ? { type: 'setDecorations', blockId: block.id, decorations } : undefined
}

// A verse far down the chapter (Psalm 119:150, otherwise about 85% in).
export const getBenchScrollCommand = (
  document: RenderDocument
): Extract<ReaderCommand, { type: 'scrollToVerse' }> | undefined => {
  const keys = new Set<string>()
  const collect = (verseKey?: string) => verseKey && keys.add(verseKey)
  for (const block of document.blocks) {
    if (block.kind === 'paragraph') block.runs.forEach(run => collect(run.verseKey))
    else if (block.kind === 'parallel' || block.kind === 'interlinear') collect(block.verseKey)
  }
  const ordered = [...keys]
  if (!ordered.length) return undefined
  const [book, chapter] = ordered[0].split('-')
  const target =
    document.fixture === 'psalm119'
      ? `${book}-${chapter}-150`
      : ordered[Math.floor(ordered.length * 0.85)]
  return { type: 'scrollToVerse', verseKey: target }
}

export const getBenchScrollTopCommand = (
  document: RenderDocument
): Extract<ReaderCommand, { type: 'scrollToVerse' }> | undefined => {
  const command = getBenchScrollCommand(document)
  if (!command) return undefined
  const [book, chapter] = command.verseKey.split('-')
  return { type: 'scrollToVerse', verseKey: `${book}-${chapter}-1` }
}
