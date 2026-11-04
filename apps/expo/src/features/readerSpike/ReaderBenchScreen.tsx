// SPIKE: the bench screen. /reader-bench?renderer=webview|views|skia&fixture=<FixtureId>&run=<n>
import { useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import {
  getBenchHighlightCommand,
  getBenchScrollCommand,
  getBenchScrollTopCommand,
} from './benchCommands'
import {
  BENCH_LOG_TAG,
  type FixtureId,
  type ReaderCommand,
  type ReaderEvent,
  type RendererId,
} from './contract'
import { FIXTURE_IDS, loadFixtureRender } from './fixtures/fixtures'
import { RENDERERS } from './renderers'

// Release builds strip `console.log` calls (babel transform-remove-console), so the bench logs
// through an alias; the line still reaches logcat under ReactNativeJS.
const benchLog = (line: string) => {
  const sink = globalThis.console
  sink.log(line)
}

const RENDERER_IDS: RendererId[] = ['webview', 'views', 'skia']

const ReaderBenchScreen = () => {
  const params = useLocalSearchParams<{ renderer?: string; fixture?: string; run?: string }>()
  const renderer = (
    RENDERER_IDS.includes(params.renderer as RendererId) ? params.renderer : 'webview'
  ) as RendererId
  const fixture = (
    FIXTURE_IDS.includes(params.fixture as FixtureId) ? params.fixture : 'psalm119'
  ) as FixtureId
  const document = useMemo(() => loadFixtureRender(fixture), [fixture])
  const Reader = RENDERERS[renderer]

  const [command, setCommand] = useState<
    (ReaderCommand & { seq: number; issuedAt: number }) | undefined
  >()
  const seq = useRef(0)

  const onEvent = useCallback(
    (event: ReaderEvent) => {
      benchLog(`${BENCH_LOG_TAG} ${JSON.stringify({ renderer, fixture, event })}`)
    },
    [renderer, fixture]
  )

  const issue = (next: ReaderCommand | undefined) => {
    if (!next) return
    seq.current += 1
    const issued = { ...next, seq: seq.current, issuedAt: Date.now() }
    benchLog(
      `${BENCH_LOG_TAG} ${JSON.stringify({
        renderer,
        fixture,
        command: {
          ...issued,
          decorations: undefined,
          decorationCount: 'decorations' in issued ? issued.decorations.length : undefined,
        },
      })}`
    )
    setCommand(issued)
  }

  return (
    <View
      testID="reader-bench"
      style={{ flex: 1, backgroundColor: document.settings.theme.background }}
    >
      <View style={{ flex: 1 }}>
        <Reader
          key={`${renderer}-${fixture}-${params.run ?? '0'}`}
          document={document}
          command={command}
          onEvent={onEvent}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          right: 8,
          bottom: 8,
          flexDirection: 'row',
          gap: 6,
          zIndex: 100,
          elevation: 100,
        }}
      >
        {[
          ['bench-highlight', 'HL', () => issue(getBenchHighlightCommand(document))],
          ['bench-scroll', 'GO', () => issue(getBenchScrollCommand(document))],
          ['bench-scroll-top', 'TOP', () => issue(getBenchScrollTopCommand(document))],
        ].map(([testID, label, onPress]) => (
          <Pressable
            key={testID as string}
            testID={testID as string}
            accessibilityLabel={testID as string}
            onPress={onPress as () => void}
            style={{
              backgroundColor: '#222',
              borderRadius: 6,
              paddingHorizontal: 10,
              paddingVertical: 8,
              opacity: 0.85,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12 }}>{label as string}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

export default ReaderBenchScreen
