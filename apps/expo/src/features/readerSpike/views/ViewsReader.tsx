// SPIKE: React wrapper for the Kotlin RecyclerView + StaticLayout reader (Android only).
import React, { useCallback, useMemo } from 'react'
import { StyleSheet } from 'react-native'

import { BibleReaderViewsView } from '../../../../modules/bible-reader-views'
import type { ReaderEvent, ReaderProps } from '../contract'

export const ViewsReader: React.FC<ReaderProps> = ({ document, command, onEvent }) => {
  const documentJson = useMemo(() => JSON.stringify(document), [document])
  const commandJson = useMemo(() => (command ? JSON.stringify(command) : undefined), [command])
  const handleEvent = useCallback(
    (e: { nativeEvent: Record<string, unknown> }) => onEvent(e.nativeEvent as unknown as ReaderEvent),
    [onEvent]
  )

  if (!BibleReaderViewsView) return null
  return (
    <BibleReaderViewsView
      style={styles.fill}
      document={documentJson}
      command={commandJson}
      onReaderEvent={handleEvent}
    />
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })
