// SPIKE: DOM-side instrumentation of the WebView renderer for the reader renderer benchmark
// (src/features/readerSpike). Every event carries t = Date.now() taken in the DOM, the same
// device wall clock the adb harness reads, and travels to React Native over the normal bridge.
import { useEffect, useRef } from 'react'
import { getWordIndexFromCharOffset, tokenizeVerseText } from '~helpers/wordTokenizer'
import { collectAnnotationTextNodes } from './AnnotationMode/annotationDomText'
import {
  findVerseContainer,
  findVerseTextElement,
  getCaretInfoFromPoint,
} from './AnnotationMode/domUtils'
import type { Dispatch } from './BibleDOMWrapper'
import { SPIKE_BENCH_EVENT } from './dispatch'

type BenchEvent = Record<string, unknown> & { type: string; t: number }

let sink: ((event: BenchEvent) => void) | null = null

const emit = (event: BenchEvent) => sink?.(event)

const afterPaint = (callback: () => void) =>
  requestAnimationFrame(() => requestAnimationFrame(callback))

// A bench decoration command is a word annotation with id `bench-cmd|<blockId>|<seq>|<n>`.
const reportedDecorationCommands = new Set<string>()
export const reportDecorationsPainted = (rects: { annotationId?: string }[]) => {
  for (const rect of rects) {
    const id = rect.annotationId
    if (!id?.startsWith('bench-cmd|')) continue
    const [, blockId, seq] = id.split('|')
    const key = `${blockId}|${seq}`
    if (reportedDecorationCommands.has(key)) continue
    reportedDecorationCommands.add(key)
    afterPaint(() => emit({ type: 'decorationsPainted', blockId, t: Date.now() }))
  }
}

export const useSpikeBench = ({
  dispatch,
  hasVerses,
  verseKeyPrefix,
  scrollTargetVerse,
  verseNavigationRequest,
}: {
  dispatch: Dispatch
  hasVerses: boolean
  verseKeyPrefix: string
  scrollTargetVerse: number | undefined
  verseNavigationRequest: number | undefined
}) => {
  useEffect(() => {
    sink = event => {
      dispatch({ type: SPIKE_BENCH_EVENT, payload: event }).catch(() => {})
    }
    return () => {
      sink = null
    }
  }, [dispatch])

  const firstTextReported = useRef(false)
  useEffect(() => {
    if (!hasVerses || firstTextReported.current) return
    firstTextReported.current = true
    afterPaint(() => emit({ type: 'firstTextPainted', t: Date.now() }))
  }, [hasVerses])

  // Declared after the reader's own scroll effects, so its requestAnimationFrame runs first.
  useEffect(() => {
    if (!hasVerses || !scrollTargetVerse) return
    afterPaint(() =>
      emit({
        type: 'scrolledToVerse',
        verseKey: `${verseKeyPrefix}-${scrollTargetVerse}`,
        t: Date.now(),
      })
    )
  }, [hasVerses, scrollTargetVerse, verseNavigationRequest, verseKeyPrefix])

  useEffect(() => {
    let down: { x: number; y: number } | null = null
    const onDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY }
    }
    const onUp = (event: PointerEvent) => {
      const t = Date.now()
      const start = down
      down = null
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return
      const caret = getCaretInfoFromPoint(event.clientX, event.clientY)
      const container = findVerseContainer(caret?.targetElement ?? null)
      const verseKey = container?.getAttribute('data-verse-key')
      const version = container?.getAttribute('data-version')
      if (!caret || !verseKey || !version) return
      emit({ type: 'verseTap', verseKey, t })
      const verseText = findVerseTextElement(version, verseKey)
      const fullText = verseText ? collectAnnotationTextNodes(verseText).fullText : ''
      const wordIndex = getWordIndexFromCharOffset(tokenizeVerseText(fullText), caret.charOffset)
      if (wordIndex !== null) emit({ type: 'wordTap', verseKey, wordIndex, t })
    }
    document.addEventListener('pointerdown', onDown, { capture: true, passive: true })
    document.addEventListener('pointerup', onUp, { capture: true, passive: true })
    return () => {
      document.removeEventListener('pointerdown', onDown, { capture: true })
      document.removeEventListener('pointerup', onUp, { capture: true })
    }
  }, [])
}
