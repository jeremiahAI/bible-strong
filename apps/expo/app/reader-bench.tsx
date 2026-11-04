import { Redirect, Stack } from 'expo-router'

import ReaderBenchScreen from '~features/readerSpike/ReaderBenchScreen'

// SPIKE: reachable in dev builds and in release builds made with EXPO_PUBLIC_READER_BENCH=1.
const READER_BENCH_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_READER_BENCH === '1'

const ReaderBenchRoute = () => {
  if (!READER_BENCH_ENABLED) return <Redirect href="/" />

  // The shared WebView sits under the navigator at zIndex -9999, so the scene must be transparent.
  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'transparentModal',
          animation: 'none',
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <ReaderBenchScreen />
    </>
  )
}

export default ReaderBenchRoute
