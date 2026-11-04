// SPIKE (dev only): loads one reader fixture into the Kotlin Views renderer.
// ?fixture=<id>&font=<family>&scroll=<verseKey>&decorate=1
import { useLocalSearchParams } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'

import type { FixtureId, ReaderCommand, ReaderEvent } from '~features/readerSpike/contract'
import { loadFixtureRender } from '~features/readerSpike/fixtures/fixtures'
import { ViewsReader } from '~features/readerSpike/views/ViewsReader'

const ReaderPocViews = () => {
  const params = useLocalSearchParams<{
    fixture?: string
    font?: string
    scroll?: string
    decorate?: string
  }>()
  const document = useMemo(() => {
    const doc = loadFixtureRender((params.fixture ?? 'psalm119') as FixtureId)
    return params.font ? { ...doc, settings: { ...doc.settings, fontFamily: params.font } } : doc
  }, [params.fixture, params.font])
  const [command, setCommand] = useState<(ReaderCommand & { seq: number; issuedAt: number }) | undefined>()

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    if (params.scroll) {
      timers.push(
        setTimeout(
          () =>
            setCommand({
              type: 'scrollToVerse',
              verseKey: params.scroll!,
              seq: 1,
              issuedAt: Date.now(),
            }),
          2000
        )
      )
    }
    if (params.decorate) {
      timers.push(
        setTimeout(
          () =>
            setCommand({
              type: 'setDecorations',
              blockId: 'p0',
              decorations: [
                { kind: 'verseHighlight', start: 0, end: 120, color: '#55EFC4', opacity: 0.6 },
                { kind: 'circle', start: 130, end: 160, color: '#D63031' },
              ],
              seq: 2,
              issuedAt: Date.now(),
            }),
          3500
        )
      )
    }
    return () => timers.forEach(clearTimeout)
  }, [params.scroll, params.decorate])

  if (!__DEV__) return null
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: 36 }}>
      <ViewsReader
        document={document}
        command={command}
        onEvent={(e: ReaderEvent) => console.log('[reader-poc-views]', JSON.stringify(e))}
      />
    </View>
  )
}

export default ReaderPocViews
