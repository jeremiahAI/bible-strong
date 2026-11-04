// SPIKE: one line per renderer. A prototype changes only its own line when it is merged.
import type { ComponentType } from 'react'

import type { ReaderProps, RendererId } from './contract'

export const RENDERERS: Record<RendererId, ComponentType<ReaderProps>> = {
  webview: require('./webview/WebViewReader').default,
  views: require('./RendererNotInBuild').default,
  skia: require('./RendererNotInBuild').default,
}
