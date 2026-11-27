import { ChevronDown, ChevronRight, Folder, FolderOpen, GitBranch } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { HostCatalogEntry } from '../../host-catalog/host-profile'
import { colors } from '../../theme/mobile-theme'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'
import type { Worktree } from '../../worktree/workspace-list/workspace-list-types'
import { homeListStyles } from '../home-list-styles'
import {
  formatMobileRelativeTime,
  type MobileCodexProjectRow,
  type MobileCodexRecentRow,
  type MobileCodexTone
} from './mobile-codex-projects'
import type { PlatformConnectionHealth } from './mobile-four-zone'
import { mobileHomeProjectsStyles as styles } from './mobile-home-projects-styles'

const INITIAL_PROJECT_THREADS = 5

function cleanBranchName(branch: string | null | undefined): string | null {
  if (!branch) {
    return null
  }
  const trimmed = branch.replace(/^refs\/heads\//, '').trim()
  return trimmed.length > 0 ? trimmed : null
}

function toneColor(tone: MobileCodexTone): string | null {
  if (tone === 'working' || tone === 'attention') {
    return colors.statusAmber
  }
  if (tone === 'active') {
    return colors.statusGreen
  }
  return null
}

function isLiveThread(item: MobileCodexRecentRow): boolean {
  return item.statusTone === 'working' || item.statusTone === 'attention' || item.unread
}

export function MobileCodexProjectRowView(props: {
  project: MobileCodexProjectRow
  multiHost: boolean
  expanded: boolean
  onlyActive: boolean
  separated: boolean
  onToggleExpand: () => void
  onOpenWorktree: (host: HostCatalogEntry, row: Worktree) => void
  onSelectThread: (item: MobileCodexRecentRow) => void
}) {
  useMobileColorScheme()
  const [showAllThreads, setShowAllThreads] = useState(false)
  const { project } = props
  const label = props.multiHost ? `${project.repo} · ${project.host.name}` : project.repo

  const filteredThreads = props.onlyActive
    ? project.threads.filter(isLiveThread)
    : project.threads
  const coveredWorktreeIds = new Set(filteredThreads.map((item) => item.worktreeId))
  const extraItems =
    project.items.length > 1
      ? project.items.filter(
          (item) =>
            !coveredWorktreeIds.has(item.row.worktreeId) &&
            (!props.onlyActive || item.working || item.active || item.unread)
        )
      : []

  const hasChildren = filteredThreads.length > 0 || extraItems.length > 0
  const childrenVisible = hasChildren && props.expanded
  const visibleThreads = showAllThreads
    ? filteredThreads
    : filteredThreads.slice(0, INITIAL_PROJECT_THREADS)
  const hiddenThreadCount = filteredThreads.length - visibleThreads.length
  const collapsedDot = !childrenVisible ? toneColor(project.statusTone) : null

  return (
    <View>
      {props.separated ? <View style={homeListStyles.separator} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          if (hasChildren) {
            props.onToggleExpand()
          } else {
            props.onOpenWorktree(project.host, project.primaryItem.row)
          }
        }}
        onLongPress={() => props.onOpenWorktree(project.host, project.primaryItem.row)}
        style={({ pressed }) => [styles.codexProjectRow, pressed && styles.rowPressed]}
      >
        <View style={styles.folderIconWrap}>
          {childrenVisible ? (
            <FolderOpen size={16} color={colors.textMuted} />
          ) : (
            <Folder size={16} color={colors.textMuted} />
          )}
        </View>
        <Text style={styles.codexProjectTitle} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.codexTrailing}>
          {collapsedDot ? (
            <View style={[styles.treeDot, { backgroundColor: collapsedDot }]} />
          ) : null}
          {!childrenVisible && project.unread ? <View style={styles.unreadDot} /> : null}
        </View>
      </Pressable>

      {childrenVisible ? (
        <View style={styles.treeThreadList}>
          {visibleThreads.map((thread) => {
            const relTime = formatMobileRelativeTime(thread.timestamp)
            const dot = toneColor(thread.statusTone)
            return (
              <Pressable
                key={thread.key}
                accessibilityRole="button"
                accessibilityLabel={thread.title}
                onPress={() => props.onSelectThread(thread)}
                style={({ pressed }) => [styles.treeThreadRow, pressed && styles.rowPressed]}
              >
                <View style={styles.treeDotSlot}>
                  {dot ? <View style={[styles.treeDot, { backgroundColor: dot }]} /> : null}
                </View>
                <Text style={styles.treeThreadTitle} numberOfLines={1}>
                  {thread.title}
                </Text>
                {relTime ? (
                  <Text style={styles.treeThreadTime} numberOfLines={1}>
                    {relTime}
                  </Text>
                ) : null}
              </Pressable>
            )
          })}

          {extraItems.map((item) => {
            const branch = cleanBranchName(item.row.branch)
            const name = item.row.displayName?.trim() || branch || project.repo
            const dot = item.working
              ? colors.statusAmber
              : item.active
                ? colors.statusGreen
                : null
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={name}
                onPress={() => props.onOpenWorktree(item.host, item.row)}
                style={({ pressed }) => [styles.branchRow, pressed && styles.rowPressed]}
              >
                <GitBranch size={12} color={colors.textMuted} />
                <Text style={styles.branchLabel} numberOfLines={1}>
                  {name}
                </Text>
                {dot ? <View style={[styles.branchDot, { backgroundColor: dot }]} /> : null}
              </Pressable>
            )
          })}

          {hiddenThreadCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAllThreads(true)}
              style={({ pressed }) => [styles.treeShowMoreRow, pressed && styles.rowPressed]}
            >
              <Text style={styles.showMoreText}>展开其余 {hiddenThreadCount} 条…</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

export function MobileCodexRecentRowView(props: {
  item: MobileCodexRecentRow
  separated: boolean
  onPress: () => void
}) {
  useMobileColorScheme()
  const { item } = props
  const relTime = formatMobileRelativeTime(item.timestamp)
  const dot = toneColor(item.statusTone)

  return (
    <View>
      {props.separated ? <View style={homeListStyles.separator} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.projectName}，${item.title}`}
        onPress={props.onPress}
        style={({ pressed }) => [styles.codexRecentRow, pressed && styles.rowPressed]}
      >
        <View style={styles.treeDotSlot}>
          {dot ? <View style={[styles.treeDot, { backgroundColor: dot }]} /> : null}
        </View>
        <Text style={styles.codexRecentTitle} numberOfLines={1}>
          {item.title}
        </Text>
        {item.title !== item.projectName ? (
          <Text style={styles.treeProjectMeta} numberOfLines={1}>
            {item.projectName}
          </Text>
        ) : null}
        {relTime ? (
          <Text style={styles.codexRecentTime} numberOfLines={1}>
            {relTime}
          </Text>
        ) : null}
      </Pressable>
    </View>
  )
}

export function MobileCodexHostGroupView(props: {
  host: HostCatalogEntry
  online: boolean
  projects: readonly MobileCodexProjectRow[]
  collapsed: boolean
  collapsedProjects: ReadonlySet<string>
  onlyActive: boolean
  onToggleHost: () => void
  onToggleProject: (projectKey: string) => void
  onOpenWorktree: (host: HostCatalogEntry, row: Worktree) => void
  onSelectThread: (item: MobileCodexRecentRow) => void
}) {
  useMobileColorScheme()
  return (
    <View style={homeListStyles.group}>
      <Pressable
        accessibilityRole="button"
        onPress={props.onToggleHost}
        style={({ pressed }) => [styles.hostGroupHeader, pressed && styles.rowPressed]}
      >
        {props.collapsed ? (
          <ChevronRight size={14} color={colors.textMuted} />
        ) : (
          <ChevronDown size={14} color={colors.textMuted} />
        )}
        <View
          style={[
            styles.hostDot,
            { backgroundColor: props.online ? colors.statusGreen : colors.textMuted }
          ]}
        />
        <Text style={styles.hostGroupTitle} numberOfLines={1}>
          {props.host.name}
        </Text>
        <Text style={styles.hostGroupCount}>{props.projects.length}</Text>
      </Pressable>
      {!props.collapsed ? (
        <View style={styles.hostGroupChildren}>
          {props.projects.map((project, index) => (
            <MobileCodexProjectRowView
              key={project.key}
              project={project}
              multiHost={false}
              expanded={!props.collapsedProjects.has(project.key)}
              onlyActive={props.onlyActive}
              separated={index > 0}
              onToggleExpand={() => props.onToggleProject(project.key)}
              onOpenWorktree={props.onOpenWorktree}
              onSelectThread={props.onSelectThread}
            />
          ))}
        </View>
      ) : null}
    </View>
  )
}

export function PlatformSegmentButton(props: {
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
      <Text style={[styles.segmentLabel, props.selected && styles.segmentLabelSelected]} numberOfLines={1}>
        {props.label}
      </Text>
      {props.count > 0 ? (
        <View style={[styles.countPill, props.selected && styles.countPillSelected]}>
          <Text style={[styles.countText, props.selected && styles.countTextSelected]}>{props.count}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}
