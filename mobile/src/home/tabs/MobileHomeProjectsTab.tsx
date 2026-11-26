import {
  ChevronRight,
  FolderGit2,
  GitBranch,
  Laptop,
  LayoutGrid,
  Monitor,
  Plus,
  Settings
} from 'lucide-react-native'
import { useMemo } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import type { HostCatalogEntry } from '../../host-catalog/host-profile'
import { useMobileTranslation } from '../../i18n/use-mobile-translation'
import { useResponsiveLayout } from '../../layout/responsive-layout'
import { colors } from '../../theme/mobile-theme'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'
import type { Worktree } from '../../worktree/workspace-list/workspace-list-types'
import { homeListStyles } from '../home-list-styles'
import { MobileHomeSectionHeading } from '../MobileHomeSectionHeading'
import type { MobileHomeData } from '../use-mobile-home-data'
import {
  buildPlatformProjectGroups,
  collectBotHomeWorktreeIds,
  countPlatformProjectItems,
  resolvePlatformConnectionHealth,
  type MobileProjectsPlatform,
  type PlatformConnectionHealth,
  type PlatformProjectItem
} from './mobile-four-zone'
import { mobileHomeProjectsStyles as styles } from './mobile-home-projects-styles'
import { MobileHomeTabEmpty } from './MobileHomeTabEmpty'
import { MobileHomeTabHeader, MobileHomeTabHeaderButton } from './MobileHomeTabHeader'

const SWIPE_THRESHOLD_PX = 42

function cleanBranchName(branch: string | null | undefined): string | null {
  if (!branch) {
    return null
  }
  const trimmed = branch.replace(/^refs\/heads\//, '').trim()
  return trimmed.length > 0 ? trimmed : null
}

/** 4-zone merged Projects tab: swipe/tap between Win and Mac project lists with compact green/red status dots. */
export function MobileHomeProjectsTab(props: {
  platform: MobileProjectsPlatform
  onSelectPlatform: (platform: MobileProjectsPlatform) => void
  data: MobileHomeData
  winHosts: HostCatalogEntry[]
  macHosts: HostCatalogEntry[]
  bottomInset: number
  onOpenHost: (host: HostCatalogEntry) => void
  onOpenHostActions: (host: HostCatalogEntry) => void
  onOpenWorktree: (host: HostCatalogEntry, row: Worktree) => void
  onPairDesktop: () => void
  onOpenSettings: () => void
  onToggleClassicLayout: () => void
}) {
  const t = useMobileTranslation()
  useMobileColorScheme()
  const { isWideLayout, contentMaxWidth } = useResponsiveLayout()
  const { data, platform, winHosts, macHosts, onSelectPlatform } = props

  const botHomeWorktreeIds = useMemo(
    () => collectBotHomeWorktreeIds(data.bots.rows),
    [data.bots.rows]
  )

  const winGroups = useMemo(
    () =>
      buildPlatformProjectGroups({
        hosts: winHosts,
        worktreeInfo: data.worktreeInfo,
        botHomeWorktreeIds
      }),
    [botHomeWorktreeIds, data.worktreeInfo, winHosts]
  )
  const macGroups = useMemo(
    () =>
      buildPlatformProjectGroups({
        hosts: macHosts,
        worktreeInfo: data.worktreeInfo,
        botHomeWorktreeIds
      }),
    [botHomeWorktreeIds, data.worktreeInfo, macHosts]
  )

  const winHealth = useMemo(
    () => resolvePlatformConnectionHealth(winHosts, data.hostStates),
    [data.hostStates, winHosts]
  )
  const macHealth = useMemo(
    () => resolvePlatformConnectionHealth(macHosts, data.hostStates),
    [data.hostStates, macHosts]
  )

  const winCount = useMemo(() => countPlatformProjectItems(winGroups), [winGroups])
  const macCount = useMemo(() => countPlatformProjectItems(macGroups), [macGroups])

  const isWin = platform === 'win'
  const currentHosts = isWin ? winHosts : macHosts
  const currentGroups = isWin ? winGroups : macGroups
  const multiHost = currentHosts.length > 1
  const currentConnecting = currentHosts.some(
    (host) => data.hostStates[host.id] === 'connecting'
  )

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .onEnd((event) => {
          if (event.translationX <= -SWIPE_THRESHOLD_PX && platform === 'win') {
            onSelectPlatform('mac')
          } else if (event.translationX >= SWIPE_THRESHOLD_PX && platform === 'mac') {
            onSelectPlatform('win')
          }
        }),
    [onSelectPlatform, platform]
  )

  const handleSegmentLongPress = (target: MobileProjectsPlatform) => {
    const targetHosts = target === 'win' ? winHosts : macHosts
    if (targetHosts.length > 0) {
      props.onOpenHostActions(targetHosts[0]!)
    } else {
      props.onPairDesktop()
    }
  }

  const header = (
    <MobileHomeTabHeader
      title="项目"
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

  const switcher = (
    <View
      style={[
        styles.switcherWrap,
        isWideLayout && { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }
      ]}
    >
      <View style={styles.switcherTrack} accessibilityRole="tablist">
        <PlatformSegmentButton
          label="Win"
          count={winCount}
          health={winHealth}
          selected={isWin}
          onPress={() => onSelectPlatform('win')}
          onLongPress={() => handleSegmentLongPress('win')}
        />
        <PlatformSegmentButton
          label="Mac"
          count={macCount}
          health={macHealth}
          selected={!isWin}
          onPress={() => onSelectPlatform('mac')}
          onLongPress={() => handleSegmentLongPress('mac')}
        />
      </View>
    </View>
  )

  if (!data.hostCatalogLoaded) {
    return (
      <>
        {header}
        {switcher}
      </>
    )
  }

  const body =
    currentHosts.length === 0 ? (
      <View style={styles.emptyWrap}>
        <MobileHomeTabEmpty
          icon={isWin ? Monitor : Laptop}
          title={isWin ? '暂无 Windows 主机' : '暂无 Mac 主机'}
          message={
            isWin
              ? '配对 Windows 电脑后，这里将直接展示它的项目列表。'
              : '配对 Mac 电脑后，这里将直接展示它的项目列表。'
          }
        />
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.pairButton, pressed && styles.pairButtonPressed]}
          onPress={props.onPairDesktop}
        >
          <Plus size={16} color={colors.onAccent} />
          <Text style={styles.pairButtonText}>
            {isWin ? '配对 Windows 主机' : '配对 Mac 主机'}
          </Text>
        </Pressable>
      </View>
    ) : currentGroups.length === 0 ? (
      currentConnecting ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
        </View>
      ) : (
        <View style={styles.emptyWrap}>
          <MobileHomeTabEmpty
            icon={FolderGit2}
            title={isWin ? '暂无可显示的 Win 项目' : '暂无可显示的 Mac 项目'}
            message={
              data.hostStates[currentHosts[0]!.id] === 'connected'
                ? '点击右下角 + 新建工作区，或在桌面端添加项目仓库。'
                : '长按上方平台标签或点下方按钮打开主机以同步项目列表。'
            }
          />
          {data.hostStates[currentHosts[0]!.id] !== 'connected' ? (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.pairButton, pressed && styles.pairButtonPressed]}
              onPress={() => props.onOpenHost(currentHosts[0]!)}
            >
              <Text style={styles.pairButtonText}>打开主机</Text>
            </Pressable>
          ) : null}
        </View>
      )
    ) : (
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: props.bottomInset },
          isWideLayout && { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }
        ]}
      >
        {currentGroups.map((group, groupIndex) => {
          const headingTitle = multiHost ? `${group.repo} · ${group.host.name}` : group.repo
          return (
            <View key={group.key}>
              <MobileHomeSectionHeading
                title={headingTitle}
                count={group.items.length}
                first={groupIndex === 0}
              />
              <View style={homeListStyles.group}>
                {group.items.map((item, itemIndex) => (
                  <ProjectWorktreeRow
                    key={item.key}
                    item={item}
                    separated={itemIndex > 0}
                    onPress={() => props.onOpenWorktree(item.host, item.row)}
                  />
                ))}
              </View>
            </View>
          )
        })}
      </ScrollView>
    )

  return (
    <View style={styles.screen}>
      {header}
      {switcher}
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.swipeArea}>{body}</View>
      </GestureDetector>
    </View>
  )
}

function PlatformSegmentButton(props: {
  label: string
  count: number
  health: PlatformConnectionHealth
  selected: boolean
  onPress: () => void
  onLongPress: () => void
}) {
  useMobileColorScheme()
  const dotColor = props.health === 'healthy' ? colors.statusGreen : colors.statusRed
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: props.selected }}
      accessibilityLabel={`${props.label}，${props.health === 'healthy' ? '已连接' : '连接异常'}${props.count > 0 ? `，${props.count} 个项目` : ''}`}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      style={({ pressed }) => [
        styles.segment,
        props.selected && styles.segmentSelected,
        pressed && styles.segmentPressed
      ]}
    >
      <View style={[styles.healthDot, { backgroundColor: dotColor }]} />
      <Text
        style={[styles.segmentLabel, props.selected && styles.segmentLabelSelected]}
        numberOfLines={1}
      >
        {props.label}
      </Text>
      {props.count > 0 ? (
        <View style={[styles.countPill, props.selected && styles.countPillSelected]}>
          <Text style={[styles.countText, props.selected && styles.countTextSelected]}>
            {props.count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}

function ProjectWorktreeRow(props: {
  item: PlatformProjectItem
  separated: boolean
  onPress: () => void
}) {
  useMobileColorScheme()
  const { item } = props
  const { row } = item
  const title = row.displayName?.trim() || row.repo
  const branch = cleanBranchName(row.branch)
  const prNumber = row.linkedPR?.number ?? null
  const agentCount = Array.isArray(row.agents) ? row.agents.length : 0

  const statusColor = item.working
    ? colors.statusAmber
    : item.active
      ? colors.statusGreen
      : colors.textMuted

  const metaParts: string[] = []
  if (branch && branch !== title) {
    metaParts.push(branch)
  }
  if (prNumber != null) {
    metaParts.push(`PR #${prNumber}`)
  }
  if (agentCount > 0) {
    metaParts.push(`${agentCount} 对话`)
  } else if (row.liveTerminalCount > 0) {
    metaParts.push(`${row.liveTerminalCount} 终端`)
  }
  const subtitle = metaParts.join(' · ')

  return (
    <View>
      {props.separated ? <View style={homeListStyles.separator} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}，${subtitle}` : title}
        onPress={props.onPress}
        style={({ pressed }) => [homeListStyles.row, pressed && homeListStyles.rowPressed]}
      >
        <View style={homeListStyles.status}>
          <View
            style={[
              styles.rowStatusDot,
              { backgroundColor: statusColor },
              !item.active && !item.working && styles.rowStatusDotIdle
            ]}
          />
        </View>
        <View style={homeListStyles.text}>
          <Text style={homeListStyles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <View style={styles.metaRow}>
              {branch && branch !== title ? (
                <GitBranch size={12} color={colors.textMuted} style={styles.branchIcon} />
              ) : null}
              <Text style={homeListStyles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={homeListStyles.trailing}>
          {item.unread ? <View style={styles.unreadDot} /> : null}
          <ChevronRight size={16} color={colors.textMuted} />
        </View>
      </Pressable>
    </View>
  )
}
