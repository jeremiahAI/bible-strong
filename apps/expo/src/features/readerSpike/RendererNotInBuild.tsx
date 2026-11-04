// SPIKE: placeholder for a renderer prototype that is not part of this build.
import { Text, View } from 'react-native'

import type { ReaderProps } from './contract'

const RendererNotInBuild = (_props: ReaderProps) => (
  <View
    testID="renderer-not-in-build"
    style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
  >
    <Text>renderer not in this build</Text>
  </View>
)

export default RendererNotInBuild
