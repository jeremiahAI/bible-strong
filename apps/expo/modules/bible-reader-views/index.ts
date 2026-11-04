// SPIKE: Android-only native reader built from RecyclerView + StaticLayout views.
import { requireNativeView } from 'expo'
import type { ComponentType } from 'react'
import type { ViewProps } from 'react-native'

export type BibleReaderViewsNativeProps = ViewProps & {
  /** RenderDocument as a JSON string. */
  document: string
  /** ReaderCommand (+ seq, issuedAt) as a JSON string. */
  command?: string
  onReaderEvent?: (event: { nativeEvent: Record<string, unknown> }) => void
}

export const BibleReaderViewsView: ComponentType<BibleReaderViewsNativeProps> | null =
  process.env.EXPO_OS === 'android'
    ? requireNativeView<BibleReaderViewsNativeProps>('BibleReaderViews')
    : null
