import { LayoutGrid, Plus, Settings, Users } from 'lucide-react-native'
import { useMemo } from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import { MobileBotsListEnd } from '../../bots/MobileBotsSectionHeader'
import { useMobileTranslation } from '../../i18n/use-mobile-translation'
import { useResponsiveLayout } from '../../layout/responsive-layout'
import { colors, spacing } from '../../theme/mobile-theme'
import { themedStyleSheet } from '../../theme/themed-styles'
import type { HomeBotRow } from '../bots/home-bot-rows'
import { homeBotRowsByComputer, MobileHomeBotRows } from '../bots/MobileHomeBotRow'
import { MobileHomeSectionHeading } from '../MobileHomeSectionHeading'
import type { MobileHomeData } from '../use-mobile-home-data'
import { homeBotsNotice } from './MobileHomeBotsTab'
import { filterHomeBotRowsByKind } from './mobile-four-zone'
import { MobileHomeTabEmpty } from './MobileHomeTabEmpty'
import { MobileHomeTabHeader, MobileHomeTabHeaderButton } from './MobileHomeTabHeader'

/** 4-zone Teams tab: shows ONLY Bot Groups (team chats) across all paired desktops. */
export function MobileHomeTeamsTab(props: {
  data: MobileHomeData
  bottomInset: number
  onOpenBot: (row: HomeBotRow) => void
  onPairDesktop: () => void
  onOpenSettings: () => void
  onToggleClassicLayout: () => void
}) {
  const t = useMobileTranslation()
  const { isWideLayout, contentMaxWidth } = useResponsiveLayout()
  const { data } = props

  const groupRows = useMemo(() => filterHomeBotRowsByKind(data.bots.rows, 'group'), [data.bots.rows])
  const computers = useMemo(() => homeBotRowsByComputer(groupRows), [groupRows])
  const notice = useMemo(
    () =>
      homeBotsNotice({
        rows: groupRows,
        unavailable: data.bots.unavailable,
        listable: data.bots.listable,
        awaiting: data.bots.awaiting
      }),
    [data.bots.awaiting, data.bots.listable, data.bots.unavailable, groupRows]
  )

  const header = (
    <MobileHomeTabHeader
      title="团队"
      trailing={
        <>
          <MobileHomeTabHeaderButton
            icon={LayoutGrid}
            accessibilityLabel="切换经典视图"
            onPress={props.onToggleClassicLayout}
          />
          <MobileHomeTabHeaderButton
            icon={Plus}
            accessibilityLabel={t('home.desktops.pairDesktop', 'Pair a desktop')}
            onPress={props.onPairDesktop}
          />
          <MobileHomeTabHeaderButton
            icon={Settings}
            accessibilityLabel={t('common.settings', 'Settings')}
            onPress={props.onOpenSettings}
          />
        </>
      }
    />
  )

  if (!data.hostCatalogLoaded) {
    return header
  }

  if (data.hostCatalog.length === 0) {
    return (
      <>
        {header}
        <MobileHomeTabEmpty
          icon={Users}
          title="暂无 Bot 团队"
          message="先配对 Windows 或 Mac 桌面端，即可同步全部 Bot 团队群聊。"
        />
      </>
    )
  }

  return (
    <>
      {header}
      {groupRows.length === 0 && notice.kind !== 'waiting' ? (
        <MobileHomeTabEmpty
          icon={Users}
          title="暂无 Bot 团队"
          message="在桌面端创建 Bot 团队后，这里会以专属群聊列表显示。"
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            { paddingBottom: props.bottomInset },
            isWideLayout && { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }
          ]}
        >
          {computers.length > 1 ? (
            computers.map((computer, index) => (
              <View key={computer.placeKey}>
                <View style={styles.computer}>
                  <MobileHomeSectionHeading
                    title={computer.label}
                    count={computer.rows.length}
                    first={index === 0}
                  />
                </View>
                <MobileHomeBotRows rows={computer.rows} onOpen={props.onOpenBot} />
              </View>
            ))
          ) : (
            <MobileHomeBotRows rows={groupRows} onOpen={props.onOpenBot} />
          )}
          {notice.kind === 'waiting' ? (
            <View style={styles.connecting}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
            </View>
          ) : notice.kind === 'lines' && notice.lines.length > 0 && groupRows.length > 0 ? (
            <MobileBotsListEnd lines={notice.lines} underRows />
          ) : null}
        </ScrollView>
      )}
    </>
  )
}

const styles = themedStyleSheet(() => ({
  computer: { paddingHorizontal: spacing.lg },
  connecting: { paddingVertical: spacing.xl, alignItems: 'center' }
}))
