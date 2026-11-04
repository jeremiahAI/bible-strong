// SPIKE: throwaway probe for "can paragraph build + layout run on the Reanimated UI runtime, and
// is it faster / does it free the JS thread?". It lays out the same text on the JS runtime and on
// the UI runtime with the system font (a TypefaceFontProvider is a JSI host object that cannot be
// captured by a worklet, which is itself a finding) and logs both timings.
import { Skia, TextDirection } from '@shopify/react-native-skia'
import { runOnUISync, scheduleOnUI } from 'react-native-worklets'

import type { Block } from '../contract'

const layoutText = (text: string, width: number, fontSize: number, lineHeight: number) => {
  'worklet'
  const t0 = performance.now()
  const builder = Skia.ParagraphBuilder.Make({
    textDirection: TextDirection.LTR,
    strutStyle: {
      strutEnabled: true,
      fontSize,
      heightMultiplier: lineHeight,
      halfLeading: true,
      forceStrutHeight: true,
    },
  })
  builder.pushStyle({ color: Skia.Color('#000'), fontSize, heightMultiplier: lineHeight })
  builder.addText(text)
  builder.pop()
  const para = builder.build()
  const t1 = performance.now()
  para.layout(width)
  const t2 = performance.now()
  return { buildMs: t1 - t0, layoutMs: t2 - t1, height: para.getHeight() }
}

export const runUiThreadProbe = (blocks: Block[], width: number, fontSize: number, lineHeight: number) => {
  const text = blocks
    .map(b => (b.kind === 'paragraph' ? b.runs.map(r => r.text).join('') : ''))
    .join('\n')
  const out: Record<string, unknown> = { chars: text.length }
  try {
    const js = layoutText(text, width, fontSize, lineHeight)
    out.js = js
    let ticks = 0
    // A JS-side counter shows whether the JS thread stays responsive during the UI-runtime work.
    const interval = setInterval(() => {
      ticks++
    }, 4)
    const tCall = performance.now()
    const ui = runOnUISync(layoutText, text, width, fontSize, lineHeight)
    out.ui = ui
    out.uiCallMs = performance.now() - tCall
    clearInterval(interval)
    out.jsTicksDuringSyncUiCall = ticks
  } catch (e) {
    out.error = String(e)
  }
  console.log(`READER_BENCH_SKIA_UI ${JSON.stringify(out)}`)
  // Async variant: fire and forget, measure how long the JS thread is blocked by the schedule call.
  try {
    const t0 = performance.now()
    scheduleOnUI(layoutText, text, width, fontSize, lineHeight)
    console.log(`READER_BENCH_SKIA_UI ${JSON.stringify({ scheduleOnUIJsBlockedMs: performance.now() - t0 })}`)
  } catch (e) {
    console.log(`READER_BENCH_SKIA_UI ${JSON.stringify({ scheduleError: String(e) })}`)
  }
}
