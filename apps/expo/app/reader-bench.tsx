import { Redirect } from 'expo-router'

import ReaderBenchScreen from '~features/readerSpike/ReaderBenchScreen'

// SPIKE: reachable in dev builds and in release builds made with EXPO_PUBLIC_READER_BENCH=1.
const READER_BENCH_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_READER_BENCH === '1'

const ReaderBenchRoute = () => {
  if (!READER_BENCH_ENABLED) return <Redirect href="/" />

  return <ReaderBenchScreen />
}

export default ReaderBenchRoute
