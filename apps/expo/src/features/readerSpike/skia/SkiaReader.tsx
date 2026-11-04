// SPIKE: throwaway Bible chapter renderer on @shopify/react-native-skia (Skia Paragraph).
// Layout, paint and hit-testing are all TypeScript, so this renderer is OTA-updatable.
//
// Shape: FlashList of rows. A row is a vertical slice (<= ~700px) of a laid-out block, shown in its
// own SkiaPictureView. A block (a paragraph, an interlinear verse, a parallel verse) is laid out
// once per (block, width, settings) and drawn into a cached SkPicture; slices replay that picture.
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { SkiaPictureView, useFonts } from '@shopify/react-native-skia'

import type { ReaderEvent, ReaderProps } from '../contract'
import { BENCH_LOG_TAG } from '../contract'
import {
  hitTestBlock,
  layoutDocument,
  nearestWord,
  verseYInBlock,
  BUNDLED_FONT_FAMILY,
  type DocumentLayout,
  type RowPlan,
} from './layout'
import { paintStats, recordRowPicture } from './paint'
import { ReaderStore } from './readerStore'

type DevOptions = { opaque?: boolean }
const devOptions = (): DevOptions =>
  (globalThis as unknown as { __SKIA_READER_OPTS__?: DevOptions }).__SKIA_READER_OPTS__ ?? {}

type Ctx = {
  store: ReaderStore
  rowPainted: (blockIdx: number, decoVersion: number) => void
}

const raf2 = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn))

const Row = memo(function Row({ row, layout, ctx }: { row: RowPlan; layout: DocumentLayout; ctx: Ctx }) {
  const block = layout.blocks[row.blockIdx]
  const state = useSyncExternalStore(ctx.store.subscribe, () => ctx.store.blockState(row.blockIdx))
  const theme = layout.theme
  const picture = useMemo(
    () =>
      recordRowPicture(
        row,
        block,
        layout.width,
        theme,
        state.decorations ? [state.decorations] : [],
        state.selection
      ),
    [row, block, layout.width, theme, state.decorations, state.selection]
  )
  useEffect(() => {
    ctx.rowPainted(row.blockIdx, state.decoVersion)
  }, [picture, ctx, row.blockIdx, state.decoVersion])
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={row.label}
      style={{ width: layout.width, height: row.height }}
    >
      <SkiaPictureView picture={picture} opaque={devOptions().opaque ?? true} style={styles.fill} />
    </View>
  )
})

const SkiaReaderBody = ({
  document: doc,
  command,
  onEvent,
  width,
  provider,
}: ReaderProps & { width: number; provider: NonNullable<ReturnType<typeof useFonts>> }) => {
  const layout = useMemo(
    () => layoutDocument(doc.blocks, width, doc.settings, provider),
    [doc, width, provider]
  )

  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  })
  const emit = useCallback(
    (event: ReaderEvent) => {
      console.log(
        `${BENCH_LOG_TAG} ${JSON.stringify({ renderer: 'skia', fixture: doc.fixture, event })}`
      )
      onEventRef.current(event)
    },
    [doc.fixture]
  )

  const [store] = useState(() => new ReaderStore())
  const listRef = useRef<FlashListRef<RowPlan>>(null)
  const scrollY = useRef(0)
  const [selecting, setSelecting] = useState(false)
  const firstPainted = useRef(false)
  const pendingDeco = useRef(new Set<number>())
  const layoutRef = useRef(layout)
  useEffect(() => {
    layoutRef.current = layout
  })

  // Layout stats, once per layout.
  useEffect(() => {
    const s = layout.stats
    console.log(
      `READER_BENCH_SKIA ${JSON.stringify({
        fixture: doc.fixture,
        width,
        blocks: s.blocks,
        rows: s.rows,
        chars: s.textChars,
        perBlockMs: { min: +s.minMs.toFixed(2), avg: +s.avgMs.toFixed(2), max: +s.maxMs.toFixed(2) },
        totalLayoutMs: +s.totalMs.toFixed(1),
        buildMs: +s.buildMs.toFixed(1),
        layoutMs: +s.layoutMs.toFixed(1),
        contentHeight: Math.round(layout.totalHeight),
        words: layout.wordCount,
        cachedBlocks: s.cachedBlocks,
      })}`
    )
  }, [layout, doc.fixture, width])

  const ctx = useMemo<Ctx>(
    () => ({
      store,
      rowPainted: (blockIdx, decoVersion) => {
        if (!firstPainted.current) {
          firstPainted.current = true
          raf2(() => emit({ type: 'firstTextPainted', t: Date.now() }))
        }
        if (decoVersion > 0 && pendingDeco.current.delete(blockIdx)) {
          const id = layoutRef.current.blocks[blockIdx].block.id
          // The picture is handed to the native view in this commit; the Skia view draws it on the
          // next vsync. Two animation frames after the commit is our "painted" approximation.
          raf2(() => emit({ type: 'decorationsPainted', blockId: id, t: Date.now() }))
        }
      },
    }),
    [store, emit]
  )

  const rowAtY = useCallback((contentY: number) => {
    const rows = layoutRef.current.rows
    let lo = 0
    let hi = rows.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (rows[mid].top <= contentY) lo = mid
      else hi = mid - 1
    }
    return rows[lo]
  }, [])

  const locate = useCallback(
    (x: number, y: number) => {
      const contentY = y + scrollY.current
      const row = rowAtY(contentY)
      if (!row) return null
      const block = layoutRef.current.blocks[row.blockIdx]
      const blockTop = block.rows[0].top
      return { block, bx: x, by: contentY - blockTop }
    },
    [rowAtY]
  )

  const lastRange = useRef<{ lo: number; hi: number } | null>(null)
  const applySelection = useCallback(
    (anchor: number, focus: number) => {
      const lo = Math.min(anchor, focus)
      const hi = Math.max(anchor, focus)
      const prev = lastRange.current
      if (prev && prev.lo === lo && prev.hi === hi) return
      lastRange.current = { lo, hi }
      store.selection = { anchor, focus }
      store.setSelection(layoutRef.current, { lo, hi })
      const words = layoutRef.current.words
      const a = words[lo].word
      const b = words[hi].word
      emit({
        type: 'selectionChanged',
        start: { verseKey: a.verseKey, wordIndex: a.wordIndex },
        end: { verseKey: b.verseKey, wordIndex: b.wordIndex },
        t: Date.now(),
      })
    },
    [store, emit]
  )
  const clearSelection = useCallback(() => {
    if (!lastRange.current) return
    lastRange.current = null
    store.selection = null
    store.setSelection(null, null)
  }, [store])

  const wordAtPoint = useCallback(
    (x: number, y: number) => {
      const hit = locate(x, y)
      if (!hit) return null
      const found = nearestWord(hit.block, hit.bx, hit.by)
      return found ? found.word.g : null
    },
    [locate]
  )

  const onTap = useCallback(
    (x: number, y: number) => {
      clearSelection()
      const hit = locate(x, y)
      if (!hit) return
      const res = hitTestBlock(hit.block, hit.bx, hit.by)
      if (!res) return
      const t = Date.now()
      if (res.wordIndex !== undefined) {
        emit({ type: 'wordTap', verseKey: res.verseKey, wordIndex: res.wordIndex, t })
      }
      emit({ type: 'verseTap', verseKey: res.verseKey, t })
    },
    [locate, clearSelection, emit]
  )

  const anchor = useRef<number | null>(null)
  const gesture = useMemo(() => {
    const tap = Gesture.Tap()
      .runOnJS(true)
      .maxDuration(300)
      .onEnd((e, success) => {
        if (success) onTap(e.x, e.y)
      })
    const select = Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(350)
      .onStart(e => {
        const g = wordAtPoint(e.x, e.y)
        if (g === null) return
        setSelecting(true)
        anchor.current = g
        applySelection(g, g)
      })
      .onUpdate(e => {
        if (anchor.current === null) return
        const g = wordAtPoint(e.x, e.y)
        if (g !== null) applySelection(anchor.current, g)
      })
      .onFinalize(() => {
        anchor.current = null
        setSelecting(false)
      })
    return Gesture.Race(select, tap)
  }, [onTap, wordAtPoint, applySelection])

  // Commands ---------------------------------------------------------------------------------
  const lastSeq = useRef(-1)
  useEffect(() => {
    if (!command || command.seq === lastSeq.current) return
    lastSeq.current = command.seq
    const lay = layoutRef.current
    if (command.type === 'setDecorations') {
      const idx = lay.blocks.findIndex(b => b.block.id === command.blockId)
      if (idx < 0) return
      pendingDeco.current.add(idx)
      store.setDecorations(idx, command.decorations)
      // A block that is not mounted paints only when scrolled to; still report after a frame.
      setTimeout(() => {
        if (pendingDeco.current.delete(idx)) {
          raf2(() => emit({ type: 'decorationsPainted', blockId: command.blockId, t: Date.now() }))
        }
      }, 120)
      return
    }
    // scrollToVerse
    let found: { row: RowPlan; dy: number } | null = null
    for (const b of lay.blocks) {
      const y = verseYInBlock(b, command.verseKey)
      if (y === null) continue
      let row = b.rows[0]
      for (const r of b.rows) if (r.blockY0 <= y) row = r
      found = { row, dy: y - row.blockY0 }
      break
    }
    if (!found) return
    const { row, dy } = found
    const index = lay.rows.indexOf(row)
    const target = row.top + dy
    void listRef.current?.scrollToIndex({ index, viewOffset: -dy, animated: false })
    let frames = 0
    let stable = 0
    let corrected = false
    const tick = () => {
      frames++
      if (Math.abs(scrollY.current - target) < 2) stable++
      else stable = 0
      if (stable >= 2) {
        raf2(() => emit({ type: 'scrolledToVerse', verseKey: command.verseKey, t: Date.now() }))
        return
      }
      if (frames === 20 && !corrected) {
        // scrollToIndex + viewOffset landed elsewhere (e.g. clamped at the end): force the offset.
        corrected = true
        void listRef.current?.scrollToOffset({ offset: target, animated: false })
      }
      if (frames > 90) {
        raf2(() => emit({ type: 'scrolledToVerse', verseKey: command.verseKey, t: Date.now() }))
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [command, store, emit])

  // Dev-only helper so adb taps can be aimed at a known word (see the PoC README in the report).
  const wrapperRef = useRef<View>(null)
  useEffect(() => {
    if (!__DEV__) return
    ;(globalThis as unknown as Record<string, unknown>).__skiaReaderDebug = {
      locate: (verseKey: string, wordIndex: number) => {
        const lay = layoutRef.current
        for (const b of lay.blocks) {
          for (const u of b.units) {
            const w = u.words.find(x => x.verseKey === verseKey && x.wordIndex === wordIndex)
            if (w) {
              const r = u.para.getRectsForRange(w.start, w.end)[0]
              const y = b.rows[0].top + u.y + r.y + r.height / 2
              const x = u.x + r.x + r.width / 2
              wrapperRef.current?.measureInWindow((wx, wy) => {
                console.log(
                  `READER_DEBUG ${JSON.stringify({
                    verseKey,
                    wordIndex,
                    text: u.text.slice(w.start, w.end),
                    contentX: x,
                    contentY: y,
                    scrollY: scrollY.current,
                    winX: wx + x,
                    winY: wy + y - scrollY.current,
                  })}`
                )
              })
              return
            }
          }
          for (const c of b.cells) {
            if (c.verseKey === verseKey && c.wordIndex === wordIndex) {
              wrapperRef.current?.measureInWindow((wx, wy) => {
                console.log(
                  `READER_DEBUG ${JSON.stringify({
                    verseKey,
                    wordIndex,
                    text: c.label,
                    winX: wx + c.x + c.width / 2,
                    winY: wy + b.rows[0].top + c.y + c.height / 2 - scrollY.current,
                  })}`
                )
              })
              return
            }
          }
        }
      },
      stats: () => ({ text: paintStats.textPictureMs, row: paintStats.rowPictureMs }),
      scrollY: () => scrollY.current,
    }
  }, [])

  const renderItem = useCallback(
    ({ item }: { item: RowPlan }) => <Row row={item} layout={layout} ctx={ctx} />,
    [layout, ctx]
  )

  return (
    <GestureDetector gesture={gesture}>
      <View ref={wrapperRef} style={styles.fill} collapsable={false}>
        <FlashList
          ref={listRef}
          data={layout.rows}
          renderItem={renderItem}
          keyExtractor={r => r.key}
          scrollEnabled={!selecting}
          onScroll={e => {
            scrollY.current = e.nativeEvent.contentOffset.y
          }}
          scrollEventThrottle={16}
          drawDistance={600}
        />
      </View>
    </GestureDetector>
  )
}

export const SkiaReader: React.FC<ReaderProps> = props => {
  const provider = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    [BUNDLED_FONT_FAMILY]: [require('~assets/fonts/LiterataBook-Regular.otf')],
  })
  const [width, setWidth] = useState(0)
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))
  return (
    <View
      style={[styles.fill, { backgroundColor: props.document.settings.theme.background }]}
      onLayout={onLayout}
    >
      {provider && width > 0 ? (
        <SkiaReaderBody {...props} width={width} provider={provider} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })
