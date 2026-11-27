import { Globe } from 'lucide-react-native'
import { Text, View } from 'react-native'
import { colors, spacing } from '../../theme/mobile-theme'
import { themedStyleSheet } from '../../theme/themed-styles'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'

export function FoldableBrowserPane() {
  useMobileColorScheme()
  return (
    <View style={styles.root}>
      <Globe size={26} color={colors.textMuted} />
      <Text style={styles.text}>浏览器分屏仅在移动客户端可用</Text>
    </View>
  )
}

const styles = themedStyleSheet(() => ({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgBase
  },
  text: { fontSize: 13, color: colors.textMuted }
}))
