// SPIKE: receives the benchmark events the DOM reports through the bridge (see
// bible/BibleDOM/spikeBench.ts) and hands them to the mounted WebView renderer.
import type { ReaderEvent } from '../contract'

let listener: ((event: ReaderEvent) => void) | null = null

export const setBenchListener = (next: ((event: ReaderEvent) => void) | null) => {
  listener = next
}

export const reportBenchEventFromDom = (payload: unknown) => {
  if (typeof payload !== 'object' || payload === null) return
  listener?.(payload as ReaderEvent)
  // SPIKE: in the real reader (no bench listener) log the event so adb logcat can time it
  if (!listener) globalThis.console.log(`READER_BENCH ${JSON.stringify({ renderer: 'webview-real', event: payload })}`)
}
