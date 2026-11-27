import {
  Clock,
  FolderGit2,
  FolderTree,
  Laptop,
  LayoutGrid,
  Monitor,
  Plus,
  Settings,
  SlidersHorizontal
} from 'lucide-react-native'
import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import type { AgentListRow } from '../../agents/agent-list-rows'
import type { HostCatalogEntry } from '../../host-catalog/host-profile'
import { useMobileTranslation } from '../../i18n/use-mobile-translation'
import { useResponsiveLayout } from '../../layout/responsive-layout'
import { colors } from '../../theme/mobile-theme'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'
import type { Worktree } from '../../worktree/workspace-list/workspace-list-types'
import { homeListStyles } from '../home-list-styles'
import type { MobileHomeData } from '../use-mobile-home-data'
import {
  buildMobileCodexProjectsModel,
  type MobileCodexProjectRow,
  type MobileCodexRecentRow
} from './mobile-codex-projects'
import {
  collectBotHomeWorktreeIds,
  resolvePlatformConnectionHealth,
  type MobileProjectsPlatform,
  type PlatformConnectionHealth
} from './mobile-four-zone'
import { mobileHomeProjectsStyles as styles } from './mobile-home-projects-styles'
import { MobileCodexProjectRowView, MobileCodexRecentRowView } from './MobileHomeProjectsRows'
import { MobileHomeTabEmpty } from './MobileHomeTabEmpty'
import { MobileHomeTabHeader, MobileHomeTabHeaderButton } from './MobileHomeTabHeader'

const SWIPE_THRESHOLD_PX = 42
const INITIAL_RECENT_LIMIT = 24

type ViewMode = 'tree' | 'recent'

function projectHasLiveActivity(project: MobileCodexProjectRow): boolean {
  return (
    project.statusTone !== 'idle' ||
    project.unread ||
    project.threads.some((t) => t.statusTone !== 'idle' || t.unread)
  )
}

/** 4-zone merged Projects tab: swipe/tap between Win and Mac in pure Codex single-tree layout. */
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
  onOpenAgent: (row: AgentListRow) => void
  onPairDesktop: () => void
  onOpenSettings: () => void
  onToggleClassicLayout: () => void
}) {
  const t = useMobileTranslation()
  useMobileColorScheme()
  const { isWideLayout, contentMaxWidth } = useResponsiveLayout()
  const { data, platform, winHosts, macHosts, onSelectPlatform } = props

  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [collapsedProjects, setCollapsedProjects] = useState<ReadonlySet<string>>(() => new Set())
  const [onlyActive, setOnlyActive] = useState(false)
  const [showAllRecent, setShowAllRecent] = useState(false)

  const botHomeWorktreeIds = useMemo(
    () => collectBotHomeWorktreeIds(data.bots.rows),
    [data.bots.rows]
  )

  const winModel = useMemo(
    () =>
      buildMobileCodexProjectsModel({
        hosts: winHosts, worktreeInfo: data.worktreeInfo, hostStates: data.hostStates,
        botHomeWorktreeIds, onlyActiveRecent: onlyActive
      }),
    [botHomeWorktreeIds, data.hostStates, data.worktreeInfo, onlyActive, winHosts]
  )
  const macModel = useMemo(
    () =>
      buildMobileCodexProjectsModel({
        hosts: macHosts, worktreeInfo: data.worktreeInfo, hostStates: data.hostStates,
        botHomeWorktreeIds, onlyActiveRecent: onlyActive
      }),
    [botHomeWorktreeIds, data.hostStates, data.worktreeInfo, onlyActive, macHosts]
  )
  const winHealth = useMemo(() => resolvePlatformConnectionHealth(winHosts, data.hostStates), [data.hostStates, winHosts])
  const macHealth = useMemo(() => resolvePlatformConnectionHealth(macHosts, data.hostStates), [data.hostStates, macHosts])

  const isWin = platform === 'win'
  const currentHosts = isWin ? winHosts : macHosts
  const currentModel = isWin ? winModel : macModel
  const multiHost = currentHosts.length > 1
  const currentConnecting = currentHosts.some((host) => data.hostStates[host.id] === 'connecting')

  const visibleProjects = useMemo(
    () =>
      onlyActive
        ? currentModel.projects.filter(projectHasLiveActivity)
        : currentModel.projects,
    [currentModel.projects, onlyActive]
  )

  const toggleProjectCollapsed = useCallback((projectKey: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectKey)) {
        next.delete(projectKey)
      } else {
        next.add(projectKey)
      }
      return next
    })
  }, [])

  const handlePressRecent = useCallback(
    (item: MobileCodexRecentRow) => {
      if (item.agentRow) {
        props.onOpenAgent(item.agentRow)
        return
      }
      if (item.row) {
        props.onOpenWorktree(item.host, item.row)
      }
    },
    [props]
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
          count={winModel.projects.length}
          health={winHealth}
          selected={isWin}
          onPress={() => onSelectPlatform('win')}
          onLongPress={() => handleSegmentLongPress('win')}
        />
        <PlatformSegmentButton
          label="Mac"
          count={macModel.projects.length}
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

  const visibleRecent = showAllRecent
    ? currentModel.recentItems
    : currentModel.recentItems.slice(0, INITIAL_RECENT_LIMIT)
  const hiddenRecentCount = currentModel.recentItems.length - visibleRecent.length

  const body =
    currentHosts.length === 0 ? (
      <View style={styles.emptyWrap}>
        <MobileHomeTabEmpty
          icon={isWin ? Monitor : Laptop}
          title={isWin ? '暂无 Windows 主机' : '暂无 Mac 主机'}
          message={
            isWin
              ? '配对 Windows 电脑后，这里将直接展示它的项目与单聊列表。'
              : '配对 Mac 电脑后，这里将直接展示它的项目与单聊列表。'
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
    ) : currentModel.projects.length === 0 && currentModel.totalRecentCount === 0 ? (
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
        <View style={[styles.sectionHeaderRow, styles.sectionHeaderFirst]}>
          <Text style={styles.sectionHeaderTitle}>{viewMode === 'tree' ? '线程' : '最近'}</Text>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={viewMode === 'tree' ? '切换为按最近时间排序' : '切换为按项目分组'}
              onPress={() => setViewMode((prev) => (prev === 'tree' ? 'recent' : 'tree'))}
              style={styles.filterButton}
            >
              {viewMode === 'tree' ? (
                <Clock size={14} color={colors.textMuted} />
              ) : (
                <FolderTree size={14} color={colors.textMuted} />
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={onlyActive ? '显示全部' : '仅显示进行中'}
              accessibilityState={{ selected: onlyActive }}
              onPress={() => setOnlyActive((prev) => !prev)}
              style={[styles.filterButton, onlyActive && styles.filterButtonActive]}
            >
              <SlidersHorizontal
                size={14}
                color={onlyActive ? colors.textPrimary : colors.textMuted}
              />
            </Pressable>
          </View>
        </View>

        {viewMode === 'tree' ? (
          <View style={homeListStyles.group}>
            {visibleProjects.length === 0 ? (
              <Text style={styles.recentEmptyText}>当前没有进行中的项目或对话</Text>
            ) : (
              visibleProjects.map((project, index) => (
                <MobileCodexProjectRowView
                  key={project.key}
                  project={project}
                  multiHost={multiHost}
                  expanded={!collapsedProjects.has(project.key)}
                  onlyActive={onlyActive}
                  separated={index > 0}
                  onToggleExpand={() => toggleProjectCollapsed(project.key)}
                  onOpenWorktree={props.onOpenWorktree}
                  onSelectThread={handlePressRecent}
                />
              ))
            )}
          </View>
        ) : (
          <View style={homeListStyles.group}>
            {visibleRecent.length === 0 ? (
              <Text style={styles.recentEmptyText}>
                {onlyActive ? '当前没有进行中的单聊' : '暂无最近单聊'}
              </Text>
            ) : (
              <>
                {visibleRecent.map((item, index) => (
                  <MobileCodexRecentRowView
                    key={item.key}
                    item={item}
                    separated={index > 0}
                    onPress={() => handlePressRecent(item)}
                  />
                ))}
                {hiddenRecentCount > 0 ? (
                  <>
                    <View style={homeListStyles.separator} />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setShowAllRecent(true)}
                      style={({ pressed }) => [styles.showMoreRow, pressed && styles.rowPressed]}
                    >
                      <Text style={styles.showMoreText}>展开其余 {hiddenRecentCount} 条…</Text>
                    </Pressable>
                  </>
                ) : null}
              </>
            )}
          </View>
        )}
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
