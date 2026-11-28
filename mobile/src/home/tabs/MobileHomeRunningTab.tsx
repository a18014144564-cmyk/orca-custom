import {
  Activity,
  BrushCleaning,
  Clock,
  Laptop,
  Layers,
  Monitor,
  Server,
  Settings
} from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import type { AgentListRow } from '../../agents/agent-list-rows'
import { botHomeWorktreeId } from '../../bots/host-bots-read'
import { ActionSheetModal } from '../../components/sheets/ActionSheetModal'
import type { HostCatalogEntry } from '../../host-catalog/host-profile'
import { useMobileTranslation } from '../../i18n/use-mobile-translation'
import { useResponsiveLayout } from '../../layout/responsive-layout'
import { triggerMediumImpact } from '../../platform/haptics/haptics'
import { colors } from '../../theme/mobile-theme'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'
import type { HomeBotRow } from '../bots/home-bot-rows'
import type { FoldableStageTarget } from '../foldable/foldable-stage-types'
import type { MobileHomeData } from '../use-mobile-home-data'
import { collectBotHomeWorktreeIds } from './mobile-four-zone'
import { mobileRunningStyles as styles } from './mobile-running-styles'
import {
  buildMobileRunningWindows,
  dismissMobileRunningWindows,
  formatIdleHideShortLabel,
  formatRunningWindowAge,
  IDLE_HIDE_PRESETS,
  setMobileRunningIdleHideMs,
  toggleMobileRunningGroupByDevice,
  useMobileRunningWindowsPrefs,
  type MobileRunningWindowItem
} from './mobile-running-windows'
import { MobileHomeTabEmpty } from './MobileHomeTabEmpty'
import { MobileHomeTabHeader, MobileHomeTabHeaderButton } from './MobileHomeTabHeader'

const KIND_LABELS = { project: '项目', bot: 'Bot', team: '团队' } as const

function isRunningItemSelected(
  item: MobileRunningWindowItem,
  target: FoldableStageTarget | null | undefined
): boolean {
  if (!target || target.hostId !== item.hostId) {
    return false
  }
  if (item.kind === 'team' && item.botRow?.kind === 'group') {
    return target.kind === 'group' && target.groupId === item.botRow.group.id
  }
  if (item.kind === 'bot' && item.botRow?.kind === 'bot') {
    return (
      target.kind === 'session' &&
      target.source === 'bot' &&
      target.worktreeId === botHomeWorktreeId(item.botRow.bot)
    )
  }
  if (item.kind === 'project' && item.agentRow) {
    if (target.kind !== 'session') {
      return false
    }
    if (target.paneKey && item.agentRow.entry.agent.paneKey) {
      return target.paneKey === item.agentRow.entry.agent.paneKey
    }
    return target.worktreeId === item.agentRow.entry.worktreeId
  }
  return false
}

const RunningWindowCard = memo(function RunningWindowCard(props: {
  item: MobileRunningWindowItem
  now: number
  showDeviceBadge: boolean
  selected?: boolean
  onPress: (item: MobileRunningWindowItem) => void
  onLongPress: (item: MobileRunningWindowItem) => void
}) {
  useMobileColorScheme()
  const { item } = props
  const DeviceIcon =
    item.platform === 'win' ? Monitor : item.platform === 'mac' ? Laptop : Server
  const deviceBadgeStyle =
    item.platform === 'win'
      ? styles.deviceBadgeWin
      : item.platform === 'mac'
        ? styles.deviceBadgeMac
        : styles.deviceBadgeOther
  const deviceTextStyle =
    item.platform === 'win'
      ? styles.deviceBadgeTextWin
      : item.platform === 'mac'
        ? styles.deviceBadgeTextMac
        : styles.deviceBadgeTextOther
  const deviceIconColor =
    item.platform === 'win' ? '#60a5fa' : item.platform === 'mac' ? '#c084fc' : '#34d399'
  const statusChipStyle =
    item.status === 'attention'
      ? styles.statusChipAttention
      : item.status === 'working'
        ? styles.statusChipWorking
        : styles.statusChipIdle
  const statusTextStyle =
    item.status === 'attention'
      ? styles.statusTextAttention
      : item.status === 'working'
        ? styles.statusTextWorking
        : styles.statusTextIdle
  const statusDotColor =
    item.status === 'attention'
      ? colors.statusRed
      : item.status === 'working'
        ? colors.statusAmber
        : colors.textMuted

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected === true }}
      accessibilityLabel={`${item.deviceName}，${item.title}`}
      onPress={() => props.onPress(item)}
      onLongPress={() => props.onLongPress(item)}
      style={({ pressed }) => [
        styles.card,
        props.selected && styles.cardSelected,
        pressed && styles.cardPressed
      ]}
    >
      <View style={styles.cardMetaRow}>
        <View style={styles.metaLeft}>
          {props.showDeviceBadge ? (
            <View style={[styles.deviceBadge, deviceBadgeStyle]}>
              <DeviceIcon size={11} color={deviceIconColor} />
              <Text style={deviceTextStyle} numberOfLines={1}>
                {item.platform === 'win'
                  ? `Win · ${item.deviceName}`
                  : item.platform === 'mac'
                    ? `Mac · ${item.deviceName}`
                    : item.deviceName}
              </Text>
            </View>
          ) : null}
          <View style={styles.kindBadge}>
            <Text style={styles.kindBadgeText}>{KIND_LABELS[item.kind]}</Text>
          </View>
        </View>
        <View style={[styles.statusChip, statusChipStyle]}>
          <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
          <Text style={statusTextStyle}>{formatRunningWindowAge(item, props.now)}</Text>
        </View>
      </View>

      <Text style={styles.cardTitle} numberOfLines={1}>
        {item.title}
      </Text>
      {item.subtitle && item.subtitle !== item.title ? (
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {item.subtitle}
        </Text>
      ) : null}
    </Pressable>
  )
})

/** Center "运行中" live windows hub across all Win / Mac / remote devices with auto-hide and 1-tap clear. */
export function MobileHomeRunningTab(props: {
  data: MobileHomeData
  winHosts: readonly HostCatalogEntry[]
  macHosts: readonly HostCatalogEntry[]
  bottomInset: number
  selectedTarget?: FoldableStageTarget | null
  onOpenAgent: (row: AgentListRow) => void
  onOpenBot: (row: HomeBotRow) => void
  onOpenSettings: () => void
}) {
  const t = useMobileTranslation()
  useMobileColorScheme()
  const { isWideLayout, contentMaxWidth } = useResponsiveLayout()
  const prefs = useMobileRunningWindowsPrefs()
  const [now, setNow] = useState(() => Date.now())
  const [timeoutSheetOpen, setTimeoutSheetOpen] = useState(false)
  const [dismissTarget, setDismissTarget] = useState<MobileRunningWindowItem | null>(null)

  const winHostIds = useMemo(() => new Set(props.winHosts.map((h) => h.id)), [props.winHosts])
  const macHostIds = useMemo(() => new Set(props.macHosts.map((h) => h.id)), [props.macHosts])
  const botHomeWorktreeIds = useMemo(
    () => collectBotHomeWorktreeIds(props.data.bots.rows),
    [props.data.bots.rows]
  )

  const model = useMemo(
    () =>
      buildMobileRunningWindows({
        hosts: props.data.sortedHostCatalog,
        winHostIds,
        macHostIds,
        hostStates: props.data.hostStates,
        worktreeInfo: props.data.worktreeInfo,
        botRows: props.data.bots.rows,
        botHomeWorktreeIds,
        prefs,
        now
      }),
    [
      botHomeWorktreeIds,
      macHostIds,
      now,
      prefs,
      props.data.bots.rows,
      props.data.hostStates,
      props.data.sortedHostCatalog,
      props.data.worktreeInfo,
      winHostIds
    ]
  )

  // Refresh every 15s while idle windows exist so auto-hide timeouts and relative ages stay accurate.
  useEffect(() => {
    if (model.idleCount === 0) {
      return undefined
    }
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [model.idleCount])

  const handleOpenItem = useCallback(
    (item: MobileRunningWindowItem) => {
      if (item.agentRow) {
        props.onOpenAgent(item.agentRow)
      } else if (item.botRow) {
        props.onOpenBot(item.botRow)
      }
    },
    [props]
  )

  const handleLongPressItem = useCallback((item: MobileRunningWindowItem) => {
    if (item.status !== 'idle') {
      return
    }
    triggerMediumImpact()
    setDismissTarget(item)
  }, [])

  const handleClearIdle = useCallback(() => {
    const idleItems = model.items.filter((item) => item.status === 'idle')
    if (idleItems.length === 0) {
      return
    }
    triggerMediumImpact()
    dismissMobileRunningWindows(idleItems)
  }, [model.items])

  const timeoutLabel = formatIdleHideShortLabel(prefs.idleHideMs)
  const summaryText =
    model.activeCount > 0 && model.idleCount > 0
      ? `${model.activeCount} 个运行中 · ${model.idleCount} 个最近活跃`
      : model.activeCount > 0
        ? `${model.activeCount} 个窗口正在运行`
        : model.idleCount > 0
          ? `${model.idleCount} 个最近聊过（${timeoutLabel === '常驻' ? '常驻' : `${timeoutLabel}后自动消失`}）`
          : '全部设备当前均空闲'

  return (
    <View style={styles.screen}>
      <MobileHomeTabHeader
        title="运行中"
        trailing={
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`空闲消失时间：${timeoutLabel}`}
              onPress={() => setTimeoutSheetOpen(true)}
              style={({ pressed }) => [styles.timeoutPill, pressed && styles.clearBtnPressed]}
            >
              <Clock size={12} color={colors.textSecondary} />
              <Text style={styles.timeoutPillText}>{timeoutLabel}</Text>
            </Pressable>
            <MobileHomeTabHeaderButton
              icon={Layers}
              accessibilityLabel={prefs.groupByDevice ? '切换为按活跃排序' : '切换为按设备分组'}
              onPress={toggleMobileRunningGroupByDevice}
            />
            <MobileHomeTabHeaderButton
              icon={Settings}
              accessibilityLabel={t('common.settings', 'Settings')}
              onPress={props.onOpenSettings}
            />
          </>
        }
      />

      <View
        style={[
          styles.statusBar,
          isWideLayout && { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }
        ]}
      >
        <Text style={styles.statusSummary} numberOfLines={1}>
          {summaryText}
        </Text>
        {model.idleCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`一键清理 ${model.idleCount} 个不聊的窗口`}
            onPress={handleClearIdle}
            style={({ pressed }) => [styles.clearBtn, pressed && styles.clearBtnPressed]}
          >
            <BrushCleaning size={13} color={colors.textPrimary} />
            <Text style={styles.clearBtnText}>清理空闲 ({model.idleCount})</Text>
          </Pressable>
        ) : null}
      </View>

      {model.items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MobileHomeTabEmpty
            icon={Activity}
            title="当前没有在运行的窗口"
            message="任意已连接电脑（Win / Mac）上的项目、Bot 或团队一旦开始跑任务或产生新对话，都会自动出现在这里。"
          />
        </View>
      ) : (
        <ScrollView
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingBottom: props.bottomInset },
            isWideLayout && { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }
          ]}
        >
          {prefs.groupByDevice
            ? model.groupedByDevice.map((group) => (
                <View key={group.hostId} style={styles.deviceSection}>
                  <View style={styles.deviceSectionHeader}>
                    <Text style={styles.deviceSectionTitle}>
                      {group.platform === 'win'
                        ? `Win · ${group.deviceName}`
                        : group.platform === 'mac'
                          ? `Mac · ${group.deviceName}`
                          : group.deviceName}
                    </Text>
                    <Text style={styles.deviceSectionCount}>{group.items.length}</Text>
                  </View>
                  {group.items.map((item) => (
                    <RunningWindowCard
                      key={item.key}
                      item={item}
                      now={now}
                      showDeviceBadge={false}
                      selected={isRunningItemSelected(item, props.selectedTarget)}
                      onPress={handleOpenItem}
                      onLongPress={handleLongPressItem}
                    />
                  ))}
                </View>
              ))
            : model.items.map((item) => (
                <RunningWindowCard
                  key={item.key}
                  item={item}
                  now={now}
                  showDeviceBadge
                  selected={isRunningItemSelected(item, props.selectedTarget)}
                  onPress={handleOpenItem}
                  onLongPress={handleLongPressItem}
                />
              ))}
        </ScrollView>
      )}

      <ActionSheetModal
        visible={timeoutSheetOpen}
        title="不聊天多久后自动消失"
        message="仅从「运行中」快捷列表隐藏，不会删除原项目或聊天记录；运行中的窗口不受影响。"
        actions={IDLE_HIDE_PRESETS.map((preset) => ({
          label: `${prefs.idleHideMs === preset.ms ? '✓ ' : ''}${preset.label}`,
          onPress: () => setMobileRunningIdleHideMs(preset.ms)
        }))}
        onClose={() => setTimeoutSheetOpen(false)}
      />

      <ActionSheetModal
        visible={dismissTarget != null}
        title={dismissTarget?.title}
        message="仅从「运行中」列表移出，不会影响原项目对话。"
        actions={
          dismissTarget
            ? [
                {
                  label: '从运行中列表移出',
                  onPress: () => dismissMobileRunningWindows([dismissTarget])
                }
              ]
            : []
        }
        onClose={() => setDismissTarget(null)}
      />
    </View>
  )
}
