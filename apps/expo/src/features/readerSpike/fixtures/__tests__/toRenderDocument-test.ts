// Regenerate the committed <id>.render.json files with:
//   READER_SPIKE_WRITE=1 yarn workspace @bible-strong/expo test -- readerSpike --maxWorkers=2
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getWordCount, tokenizeVerseText } from '~helpers/wordTokenizer'
import type { Block, Run } from '../../contract'
import { FIXTURE_IDS, loadFixtureSource } from '../fixtures'
import { toRenderDocument } from '../toRenderDocument'

const dir = join(__dirname, '..')

const runBlocks = (blocks: Block[]) =>
  blocks.flatMap(block =>
    block.kind === 'paragraph'
      ? [{ runs: block.runs, decorations: block.decorations }]
      : block.kind === 'parallel'
        ? block.columns.map(column => ({ runs: column.runs, decorations: column.decorations }))
        : []
  )

// Text of one verse as the DOM annotation mode reads it: no verse number, no Strong marker.
const verseTextFromRuns = (runs: Run[], verseKey: string) =>
  runs
    .filter(run => run.verseKey === verseKey && (run.role === 'word' || run.role === 'space'))
    .map(run => run.text)
    .join('')

describe.each(FIXTURE_IDS)('readerSpike fixture %s', id => {
  const source = loadFixtureSource(id)
  const document = toRenderDocument(source)

  it('converts to a document with blocks', () => {
    expect(document.fixture).toBe(id)
    expect(document.blocks.length).toBeGreaterThan(0)
  })

  it('matches the committed render.json', () => {
    const path = join(dir, `${id}.render.json`)
    if (process.env.READER_SPIKE_WRITE === '1') {
      writeFileSync(path, `${JSON.stringify(document)}\n`)
    }
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(JSON.parse(JSON.stringify(document)))
  })

  it('numbers words exactly as the DOM annotation tokenizer does', () => {
    const versions = [
      { version: source.version, verses: source.verses },
      ...(source.parallelVersions ?? []).map(p => ({ version: p.id, verses: p.verses })),
    ]
    if (id === 'genesis1-bhg-interlinear') {
      for (const block of document.blocks) {
        if (block.kind !== 'interlinear') continue
        const verse = source.verses.find(
          v => `${v.Livre}-${v.Chapitre}-${v.Verset}` === block.verseKey
        )!
        const count = getWordCount(tokenizeVerseText(verse.Texte))
        for (const word of block.words) {
          expect(word.wordIndex).toBeGreaterThanOrEqual(0)
          expect(word.wordIndex).toBeLessThan(count)
        }
      }
      return
    }
    const columns = runBlocks(document.blocks)
    let checkedVerses = 0
    for (const { verses } of versions) {
      for (const verse of verses) {
        const verseKey = `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`
        const tokens = tokenizeVerseText(verse.Texte)
        const owners = columns.filter(c => c.runs.some(r => r.verseKey === verseKey))
        // the main version, then each parallel column, own a verse once
        if (!owners.length) continue
        // a verse can span several paragraphs; parallel columns are one per version
        const column = {
          runs: (source.fixture === 'john1-parallel'
            ? [owners[versions.findIndex(v => v.verses === verses)]]
            : owners
          ).flatMap(owner => owner.runs),
        }
        const text = verseTextFromRuns(column.runs, verseKey)
        // line starts add '\n' runs; compare the words, which is what wordIndex counts
        const words = column.runs.filter(r => r.verseKey === verseKey && r.role === 'word')
        const byIndex = new Map<number, string>()
        for (const run of words) {
          byIndex.set(run.wordIndex!, (byIndex.get(run.wordIndex!) ?? '') + run.text)
        }
        const expected = tokens.filter(t => !t.isWhitespace)
        expect([...byIndex.keys()]).toEqual(expected.map(t => t.index))
        expected.forEach(t => expect(byIndex.get(t.index)).toBe(t.word))
        expect(text.replace(/\s+/gu, ' ').trim()).toBe(verse.Texte.replace(/\s+/gu, ' ').trim())
        checkedVerses += 1
      }
    }
    expect(checkedVerses).toBeGreaterThan(0)
  })

  it('keeps decoration offsets in range', () => {
    for (const { runs, decorations } of runBlocks(document.blocks)) {
      const length = runs.reduce((sum, run) => sum + run.text.length, 0)
      for (const decoration of decorations) {
        expect(decoration.start).toBeGreaterThanOrEqual(0)
        expect(decoration.end).toBeLessThanOrEqual(length)
        expect(decoration.end).toBeGreaterThan(decoration.start)
      }
    }
  })
})

it('psalm 119 has all 176 verses', () => {
  expect(loadFixtureSource('psalm119').verses).toHaveLength(176)
})

it('romans8-annotated carries every stored word annotation as a decoration', () => {
  const source = loadFixtureSource('romans8-annotated')
  const document = toRenderDocument(source)
  const decorations = runBlocks(document.blocks).flatMap(b => b.decorations)
  const ranges = Object.values(source.wordAnnotations ?? {}).flatMap(a => a.ranges)
  const annotationKinds = decorations.filter(d => d.kind !== 'verseHighlight')
  expect(annotationKinds).toHaveLength(ranges.length)
  expect(decorations.filter(d => d.kind === 'verseHighlight').length).toBe(
    Object.keys(source.highlights ?? {}).length
  )
})
