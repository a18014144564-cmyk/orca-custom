import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { getProviderDisplayName } from '../../../../src/shared/agent-usage/display/usage-provider-windows'
import type { AccountsSnapshot, ProviderRateLimits } from '../../accounts/accounts-snapshot'
import { ProviderUsageWindows } from '../../accounts/ProviderUsageWindows'
import { UsageStatusNote } from '../../accounts/usage/UsageStatusNote'
import { MobileAgentIcon } from '../../components/icons/MobileAgentIcon'
import { useMobileTranslation } from '../../i18n/use-mobile-translation'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'
import { mobileHomeUsageStyles as styles } from './mobile-home-usage-styles'

function readOtherProviderSubtitle(
  snapshot: AccountsSnapshot,
  limits: ProviderRateLimits
): string | null {
  if (limits.provider !== 'antigravity') {
    return null
  }
  const rawAccounts: unknown = snapshot.rateLimits.antigravityAccounts
  if (!Array.isArray(rawAccounts)) {
    return null
  }
  for (const item of rawAccounts) {
    if (
      typeof item === 'object' &&
      item !== null &&
      'email' in item &&
      typeof item.email === 'string' &&
      item.email.length > 0
    ) {
      if ('active' in item && item.active === true) {
        return item.email
      }
    }
  }
  const first = rawAccounts.find(
    (item): item is { email: string } =>
      typeof item === 'object' &&
      item !== null &&
      'email' in item &&
      typeof item.email === 'string' &&
      item.email.length > 0
  )
  return first?.email ?? null
}

export function MobileHomeOtherUsageCard(props: {
  snapshot: AccountsSnapshot
  limits: ProviderRateLimits
  now: number
  reducedMotion: boolean
  onPress: () => void
}) {
  const t = useMobileTranslation()
  useMobileColorScheme()
  const [pressed, setPressed] = useState(false)
  const title = getProviderDisplayName(props.limits.provider)
  const subtitle = readOtherProviderSubtitle(props.snapshot, props.limits)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
      accessibilityHint={t('home.usage.openAccountsHint', 'Opens this desktop’s accounts')}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={props.onPress}
    >
      <Animated.View
        style={[
          styles.card,
          pressed && styles.cardPressed,
          {
            transform: [{ scale: pressed && !props.reducedMotion ? 0.98 : 1 }],
            transitionProperty: ['transform', 'backgroundColor'],
            transitionDuration: 120
          }
        ]}
      >
        <View style={styles.head}>
          <View style={styles.tile}>
            <MobileAgentIcon agentId={props.limits.provider} size={16} />
          </View>
          <View style={styles.headText}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        <ProviderUsageWindows limits={props.limits} now={props.now} />
        <UsageStatusNote limits={props.limits} />
      </Animated.View>
    </Pressable>
  )
}
