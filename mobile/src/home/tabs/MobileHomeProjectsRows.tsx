import { ChevronDown, ChevronRight, GitBranch } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'
import { MobileRepoIcon } from '../../components/icons/MobileRepoIcon'
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
import { mobileHomeProjectsStyles as styles } from './mobile-home-projects-styles'

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

function CornerStatusDot({ tone }: { tone: MobileCodexTone }) {
  useMobileColorScheme()
  const dotColor = toneColor(tone)
  if (!dotColor) {
    return null
  }
  return <View style={[styles.cornerDot, { backgroundColor: dotColor }]} pointerEvents="none" />
}

export function MobileCodexProjectRowView(props: {
  project: MobileCodexProjectRow
  multiHost: boolean
  anyExpandable: boolean
  expanded: boolean
  separated: boolean
  onToggleExpand: () => void
  onOpenWorktree: (host: HostCatalogEntry, row: Worktree) => void
}) {
  useMobileColorScheme()
  const { project } = props
  const isMulti = project.items.length > 1
  const label = props.multiHost ? `${project.repo} · ${project.host.name}` : project.repo

  return (
    <View>
      {props.separated ? <View style={homeListStyles.separator} /> : null}
      <View style={styles.codexProjectRow}>
        {props.anyExpandable ? (
          isMulti ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={props.expanded ? '收起分支' : '展开分支'}
              hitSlop={8}
              onPress={props.onToggleExpand}
              style={styles.expandButton}
            >
              {props.expanded ? (
                <ChevronDown size={14} color={colors.textMuted} />
              ) : (
                <ChevronRight size={14} color={colors.textMuted} />
              )}
            </Pressable>
          ) : (
            <View style={styles.expandSpacer} />
          )
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => props.onOpenWorktree(project.host, project.primaryItem.row)}
          style={({ pressed }) => [styles.codexProjectMain, pressed && styles.rowPressed]}
        >
          <View style={styles.markWrap}>
            <MobileRepoIcon
              repoIcon={project.markIcon}
              size={24}
              color={project.markColor}
            />
            <CornerStatusDot tone={project.statusTone} />
          </View>
          <Text style={styles.codexProjectTitle} numberOfLines={1}>
            {label}
          </Text>
          <View style={styles.codexTrailing}>
            {project.openCount > 0 ? (
              <View style={styles.tabCountPill}>
                <Text style={styles.tabCountText}>{project.openCount}</Text>
              </View>
            ) : null}
            {project.unread ? <View style={styles.unreadDot} /> : null}
          </View>
        </Pressable>
      </View>

      {isMulti && props.expanded ? (
        <View style={styles.branchList}>
          {project.items.map((item) => {
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

  return (
    <View>
      {props.separated ? <View style={homeListStyles.separator} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.projectName}，${item.title}`}
        onPress={props.onPress}
        style={({ pressed }) => [styles.codexRecentRow, pressed && styles.rowPressed]}
      >
        <View style={styles.markWrapSmall}>
          <MobileRepoIcon repoIcon={item.markIcon} size={20} color={item.markColor} />
          <CornerStatusDot tone={item.statusTone} />
        </View>
        <Text style={styles.codexRecentTitle} numberOfLines={1}>
          {item.title}
        </Text>
        {relTime ? (
          <Text style={styles.codexRecentTime} numberOfLines={1}>
            {relTime}
          </Text>
        ) : null}
      </Pressable>
    </View>
  )
}
