import { Laptop, LayoutGrid, Monitor, Plus, Settings } from 'lucide-react-native'
import { useMemo } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { MobileAgentListRows, type AgentListRowHandlers } from '../../agents/MobileAgentListRows'
import type { HostCatalogEntry, HostProfile } from '../../host-catalog/host-profile'
import { useMobileTranslation } from '../../i18n/use-mobile-translation'
import { useResponsiveLayout } from '../../layout/responsive-layout'
import { colors, radii, spacing } from '../../theme/mobile-theme'
import { themedStyleSheet } from '../../theme/themed-styles'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'
import { MobileHomeHostList } from '../MobileHomeHostList'
import { MobileHomeSectionHeading } from '../MobileHomeSectionHeading'
import type { MobileHomeData } from '../use-mobile-home-data'
import { filterAgentRowsByHostIds } from './mobile-four-zone'
import { MobileHomeTabEmpty } from './MobileHomeTabEmpty'
import { MobileHomeTabHeader, MobileHomeTabHeaderButton } from './MobileHomeTabHeader'

/** 4-zone Win or Mac tab: shows paired hosts for that OS and their live workspaces/agents. */
export function MobileHomePlatformHostsTab(props: {
  platform: 'win' | 'mac'
  data: MobileHomeData
  hosts: HostCatalogEntry[]
  profiles: HostProfile[]
  bottomInset: number
  agentHandlers: AgentListRowHandlers
  onOpenHost: (host: HostCatalogEntry) => void
  onOpenHostActions: (host: HostCatalogEntry) => void
  onPairDesktop: () => void
  onOpenSettings: () => void
  onToggleClassicLayout: () => void
}) {
  const t = useMobileTranslation()
  useMobileColorScheme()
  const { isWideLayout, contentMaxWidth } = useResponsiveLayout()
  const { data, hosts, platform, profiles } = props

  const isWin = platform === 'win'
  const title = isWin ? 'Win' : 'Mac'
  const Icon = isWin ? Monitor : Laptop

  const hostIds = useMemo(() => hosts.map((host) => host.id), [hosts])
  const platformAgents = useMemo(
    () => filterAgentRowsByHostIds(data.activeAgents, hostIds),
    [data.activeAgents, hostIds]
  )

  const header = (
    <MobileHomeTabHeader
      title={title}
      trailing={
        <>
          <MobileHomeTabHeaderButton
            icon={LayoutGrid}
            accessibilityLabel="切换经典视图"
            onPress={props.onToggleClassicLayout}
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

  if (hosts.length === 0) {
    return (
      <>
        {header}
        <View style={styles.emptyWrap}>
          <MobileHomeTabEmpty
            icon={Icon}
            title={isWin ? '暂无已配对的 Windows 主机' : '暂无已配对的 Mac 主机'}
            message={
              isWin
                ? '配对你的 Windows 电脑后，可直接访问项目、代码、终端、浏览器与工作区。'
                : '配对你的 Mac 电脑后，可直接访问项目、代码、终端、浏览器与工作区。'
            }
          />
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.pairButton, pressed && styles.pairButtonPressed]}
            onPress={props.onPairDesktop}
          >
            <Plus size={16} color="#fff" />
            <Text style={styles.pairButtonText}>
              {isWin ? '配对 Windows 主机' : '配对 Mac 主机'}
            </Text>
          </Pressable>
        </View>
      </>
    )
  }

  return (
    <>
      {header}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: props.bottomInset },
          isWideLayout && { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }
        ]}
      >
        <MobileHomeHostList
          autoConnectHostIds={data.autoConnectHostIds}
          first
          hostAttempts={data.hostAttempts}
          hostLastConnected={data.hostLastConnected}
          hostConnections={data.hostConnections}
          hosts={hosts}
          hostStates={data.hostStates}
          needsYouByHost={data.needsYouByHost}
          worktreeInfo={data.worktreeInfo}
          onOpen={props.onOpenHost}
          onOpenActions={props.onOpenHostActions}
          onPairDesktop={props.onPairDesktop}
        />
        {platformAgents.length > 0 ? (
          <>
            <MobileHomeSectionHeading
              title={isWin ? 'Win 活跃对话' : 'Mac 活跃对话'}
              count={platformAgents.length}
              first={false}
            />
            <MobileAgentListRows
              rows={platformAgents}
              footer="workspace"
              nameDesktop={profiles.length > 1}
              hosts={profiles}
              now={data.agentList.now}
              handlers={props.agentHandlers}
            />
          </>
        ) : null}
      </ScrollView>
    </>
  )
}

const styles = themedStyleSheet(() => ({
  content: { paddingHorizontal: spacing.lg },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xl
  },
  pairButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentBlue,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill
  },
  pairButtonPressed: { opacity: 0.85 },
  pairButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  }
}))
