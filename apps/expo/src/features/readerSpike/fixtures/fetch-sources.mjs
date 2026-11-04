// SPIKE: regenerates the <id>.source.json fixtures from the public production Resource API.
// Read-only GETs only. Run: node apps/expo/src/features/readerSpike/fixtures/fetch-sources.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.RESOURCE_API_URL ?? 'https://api.bible-strong.app'
const here = dirname(fileURLToPath(import.meta.url))

const get = async path => {
  const response = await fetch(`${BASE}${path}`, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return response.json()
}

// Same mapping as toVerse in src/features/resources/bibleChapterSource.ts
const toVerse = (book, chapter, revision, verse) => ({
  Livre: book,
  Chapitre: chapter,
  Verset: verse.number,
  Texte: verse.text,
  TextRevision: revision,
  StartTags: verse.presentation.startTags,
  Layout: verse.presentation.layout,
  Notes: verse.presentation.notes,
  Headings: verse.presentation.headings,
})

const loadBible = async (version, book, chapter) => {
  const dto = await get(`/v1/bibles/${version}/books/${book}/chapters/${chapter}`)
  const revision = dto.resource.textRevision ?? dto.resource.revision
  return {
    textRevision: revision,
    verses: dto.verses.map(verse => toVerse(book, chapter, revision, verse)),
  }
}

const withStrong = async (version, book, chapter) => {
  const bible = await loadBible(version, book, chapter)
  const strong = await get(`/v1/strong-bibles/${version}/books/${book}/chapters/${chapter}`)
  const spansByVerse = new Map(strong.verses.map(verse => [verse.number, verse.spans]))
  return {
    ...bible,
    verses: bible.verses.map(verse => ({
      ...verse,
      StrongSpans: (spansByVerse.get(Number(verse.Verset)) ?? []).map(span => ({
        ordinal: span.ordinal,
        startOffset: span.startOffset,
        length: span.length,
        identities: span.identities.map(({ kind, code }) => ({ kind, code })),
        ...(span.morphologies ? { morphologies: span.morphologies } : {}),
      })),
    })),
  }
}

const withInterlinear = async (version, book, chapter, locale) => {
  const bible = await loadBible(version, book, chapter)
  const index = await get(
    `/v1/interlinear-bibles/${version}/languages/${locale}/books/${book}/chapters/${chapter}`
  )
  const tokensByVerse = new Map(index.verses.map(verse => [verse.number, verse.tokens]))
  return {
    ...bible,
    verses: bible.verses.map(verse => ({
      ...verse,
      InterlinearTokens: tokensByVerse.get(Number(verse.Verset)) ?? [],
    })),
  }
}

const write = (id, source) => {
  writeFileSync(join(here, `${id}.source.json`), `${JSON.stringify(source)}\n`)
  console.log(`${id}: ${source.verses.length} verses`)
}

// Word annotation ranges are word indices of the verse text, as the DOM annotation mode counts them.
const wordsOf = text => text.match(/\S+/g) ?? []
const annotate = (verses, version, specs) =>
  Object.fromEntries(
    specs.map((spec, index) => {
      const id = `bench-annotation-${index + 1}`
      const ranges = spec.ranges.map(([verse, startWordIndex, endWordIndex]) => {
        const text = verses.find(v => Number(v.Verset) === verse).Texte
        return {
          verseKey: `${verses[0].Livre}-${verses[0].Chapitre}-${verse}`,
          startWordIndex,
          endWordIndex,
          text: wordsOf(text)
            .slice(startWordIndex, endWordIndex + 1)
            .join(' '),
        }
      })
      return [
        id,
        {
          id,
          version,
          ranges,
          textRevision: verses[0].TextRevision,
          color: spec.color,
          type: spec.type,
          date: 1760000000000 + index,
        },
      ]
    })
  )

const main = async () => {
  const psalm = await loadBible('LSG', 19, 119)
  write('psalm119', { fixture: 'psalm119', version: 'LSG', book: 19, chapter: 119, ...psalm })

  const johnStrong = await withStrong('KJV', 43, 1)
  write('john1-strong', {
    fixture: 'john1-strong',
    version: 'KJV',
    book: 43,
    chapter: 1,
    interlinearMode: 'strong',
    ...johnStrong,
  })

  const genesis = await withInterlinear('BHG', 1, 1, 'en')
  write('genesis1-bhg-interlinear', {
    fixture: 'genesis1-bhg-interlinear',
    version: 'BHG',
    book: 1,
    chapter: 1,
    interlinearMode: 'interlinear',
    interlinearLocale: 'en',
    ...genesis,
  })

  const johnLsg = await loadBible('LSG', 43, 1)
  const johnKjv = await loadBible('KJV', 43, 1)
  write('john1-parallel', {
    fixture: 'john1-parallel',
    version: 'LSG',
    book: 43,
    chapter: 1,
    ...johnLsg,
    parallelVersions: [{ id: 'KJV', ...johnKjv }],
  })

  const romans = await loadBible('LSG', 45, 8)
  const highlights = Object.fromEntries(
    [
      [1, 'color3'],
      [2, 'color3'],
      [18, 'color4'],
      [28, 'color2'],
      [31, 'color1'],
      [38, 'color5'],
    ].map(([verse, color]) => [`45-8-${verse}`, { color, date: 1760000000000, version: 'LSG' }])
  )
  const wordAnnotations = annotate(romans.verses, 'LSG', [
    { color: 'color1', type: 'background', ranges: [[3, 0, 6]] },
    { color: 'color2', type: 'underline', ranges: [[5, 2, 8]] },
    { color: 'color4', type: 'circle', ranges: [[14, 0, 5]] },
    { color: 'color3', type: 'background', ranges: [[15, 4, 12]] },
    {
      color: 'color2',
      type: 'underline',
      ranges: [
        [26, 0, 4],
        [27, 0, 3],
      ],
    },
    { color: 'color1', type: 'background', ranges: [[29, 3, 10]] },
    { color: 'color5', type: 'circle', ranges: [[35, 0, 2]] },
    { color: 'color4', type: 'underline', ranges: [[39, 0, 10]] },
  ])
  write('romans8-annotated', {
    fixture: 'romans8-annotated',
    version: 'LSG',
    book: 45,
    chapter: 8,
    ...romans,
    highlights,
    wordAnnotations,
  })
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
