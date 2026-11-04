// SPIKE: dev-only test route for the Skia reader PoC. Not shipped: renders nothing outside __DEV__.
// biblestrong://reader-poc-skia?fixture=psalm119[&font=literata][&opaque=0][&scrollTo=19-119-100]
//   [&decorate=p0][&autoscroll=1]
import React, { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import type { Decoration, FixtureId, ReaderProps, RenderDocument } from '~features/readerSpike/contract'
import { loadFixtureRender } from '~features/readerSpike/fixtures/fixtures'
import { runUiThreadProbe } from '~features/readerSpike/skia/uiThreadProbe'
import { SkiaReader } from '~features/readerSpike/skia/SkiaReader'

type Command = NonNullable<ReaderProps['command']>

export default function ReaderPocSkiaRoute() {
  const params = useLocalSearchParams<{
    fixture?: string
    font?: string
    opaque?: string
    scrollTo?: string
    decorate?: string
    top?: string
    probe?: string
  }>()
  const [command, setCommand] = useState<Command>()
  const [doc] = useState<RenderDocument | null>(() => {
    if (!__DEV__) return null
    const d = loadFixtureRender((params.fixture ?? 'psalm119') as FixtureId)
    return params.font === 'literata' ? { ...d, settings: { ...d.settings, fontFamily: 'Literata Book' } } : d
  })

  useEffect(() => {
    ;(globalThis as unknown as Record<string, unknown>).__SKIA_READER_OPTS__ = {
      opaque: params.opaque !== '0',
    }
    if (params.probe === '1' && doc) {
      setTimeout(() => runUiThreadProbe(doc.blocks, 360, doc.settings.fontSizePx, doc.settings.lineHeight), 1500)
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    let seq = 0
    if (params.scrollTo) {
      timers.push(
        setTimeout(() => {
          setCommand({ type: 'scrollToVerse', verseKey: params.scrollTo!, seq: ++seq, issuedAt: Date.now() })
        }, 2500)
      )
    }
    if (params.decorate && doc) {
      const block = doc.blocks.find(b => b.id === params.decorate)
      if (block?.kind === 'paragraph') {
        const run = block.runs.filter(r => r.role === 'word').slice(5, 9)
        const start = block.runs.slice(0, block.runs.indexOf(run[0])).reduce((a, r) => a + r.text.length, 0)
        const end = start + block.runs.slice(block.runs.indexOf(run[0]), block.runs.indexOf(run[3]) + 1).reduce((a, r) => a + r.text.length, 0)
        const decorations: Decoration[] = [
          { kind: 'verseHighlight', start: 0, end: Math.min(160, start), color: 'rgba(255,214,10,0.35)' },
          { kind: 'underline', start, end, color: '#E5484D' },
          { kind: 'circle', start: end + 12, end: end + 40, color: '#5983F0' },
        ]
        timers.push(
          setTimeout(() => {
            setCommand({ type: 'setDecorations', blockId: block.id, decorations, seq: ++seq, issuedAt: Date.now() })
          }, 3500)
        )
      }
    }
    return () => timers.forEach(clearTimeout)
  }, [params.opaque, params.scrollTo, params.decorate, doc])

  if (!__DEV__ || !doc) return null
  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: doc.settings.theme.background }]}>
      <View style={[styles.statusBar, { height: Number(params.top ?? 40) }]} />
      <SkiaReader
        document={doc}
        command={command}
        onEvent={() => {
          // Events are logged by the renderer as READER_BENCH lines.
        }}
      />
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({ root: { flex: 1 }, statusBar: {} })
