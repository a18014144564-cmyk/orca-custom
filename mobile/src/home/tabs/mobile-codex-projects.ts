import { DEFAULT_REPO_BADGE_COLOR } from '../../../../src/shared/repository/appearance/repo-badge-color'
import {
  repoMarkKey,
  resolveRepoMarkAppearances
} from '../../../../src/shared/repository/appearance/repo-mark-appearance'
import type { RepoIcon } from '../../../../src/shared/repository/appearance/repo-icon'
import type { WorkspaceLineage } from '../../../../src/shared/worktree/lineage-types'
import {
  agentStatusGroup,
  everyRow,
  hostAgents,
  type AgentListRow
} from '../../agents/agent-list-rows'
import type { HostCatalogEntry } from '../../host-catalog/host-profile'
import type { ConnectionState } from '../../transport/connection/connection-state'
import type { HostWorktreeInfo } from '../../worktree/catalog/home-worktree-info'
import type { Worktree } from '../../worktree/workspace-list/workspace-list-types'
import {
  buildPlatformProjectGroups,
  type PlatformProjectGroup,
  type PlatformProjectItem
} from './mobile-four-zone'

export type MobileCodexTone = 'working' | 'attention' | 'active' | 'idle'

export type MobileCodexProjectRow = Readonly<{
  key: string
  host: HostCatalogEntry
  repo: string
  markIcon: RepoIcon
  markColor: string
  primaryItem: PlatformProjectItem
  items: readonly PlatformProjectItem[]
  threads: readonly MobileCodexRecentRow[]
  openCount: number
  statusTone: MobileCodexTone
  unread: boolean
  lastActivityAt: number
}>

export type MobileCodexRecentRow = Readonly<{
  key: string
  kind: 'agent' | 'worktree'
  title: string
  projectName: string
  host: HostCatalogEntry
  worktreeId: string
  row: Worktree | null
  agentRow: AgentListRow | null
  markIcon: RepoIcon
  markColor: string
  statusTone: MobileCodexTone
  unread: boolean
  timestamp: number
}>

export type MobileCodexProjectsModel = Readonly<{
  projects: readonly MobileCodexProjectRow[]
  recentItems: readonly MobileCodexRecentRow[]
  totalRecentCount: number
}>

const TONE_PRIORITY: Record<MobileCodexTone, number> = { working: 3, attention: 2, active: 1, idle: 0 }

function higherTone(left: MobileCodexTone, right: MobileCodexTone): MobileCodexTone {
  return TONE_PRIORITY[left] >= TONE_PRIORITY[right] ? left : right
}

export function isExcludedMobileBotOrWorkerRow(
  row: Worktree,
  botHomeWorktreeIds: ReadonlySet<string>,
  workspaceLineage?: Readonly<Record<string, WorkspaceLineage | undefined>>
): boolean {
  if (row.isArchived === true || row.botHome === true || Boolean(row.bot) || row.repo === 'Bots' || botHomeWorktreeIds.has(row.worktreeId)) {
    return true
  }
  const lineage = workspaceLineage?.[row.worktreeId]
  return Boolean(
    lineage &&
      (lineage.origin === 'orchestration' || lineage.capture?.source === 'bot-hand-over' || lineage.orchestrationRunId)
  )
}

export function formatMobileRelativeTime(timestamp: number, now: number = Date.now()): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return ''
  }
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (diffSec < 60) {
    return '刚刚'
  }
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) {
    return `${diffMin}m`
  }
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) {
    return `${diffHour}h`
  }
  const diffDay = Math.floor(diffHour / 24)
  return diffDay < 30 ? `${diffDay}d` : `${Math.floor(diffDay / 30)}mo`
}

function resolveProjectMarks(groups: readonly PlatformProjectGroup[]): Map<string, { icon: RepoIcon; color: string }> {
  const inputs = groups.map((group, index) => {
    const first = group.items[0]!.row
    return {
      id: `${group.host.id}::${first.repoId || group.repo}`,
      displayName: group.repo,
      badgeColor: DEFAULT_REPO_BADGE_COLOR,
      repoIcon: null,
      addedAt: first.createdAt ?? index
    }
  })
  const resolved = resolveRepoMarkAppearances(inputs)
  const byGroupKey = new Map<string, { icon: RepoIcon; color: string }>()
  groups.forEach((group, index) => {
    const mark = resolved.get(repoMarkKey(inputs[index]!)) ?? {
      icon: { type: 'letters' as const, text: group.repo.slice(0, 2).toUpperCase() || '?' },
      color: DEFAULT_REPO_BADGE_COLOR
    }
    byGroupKey.set(group.key, mark)
  })
  return byGroupKey
}

function worktreeOpenCount(row: Worktree): number {
  const agentCount = Array.isArray(row.agents)
    ? row.agents.filter((a) => !a.paneKey.includes('bot-group-member-') && a.parentPaneKey == null).length
    : 0
  return Math.max(agentCount, row.liveTerminalCount ?? 0)
}

function itemTone(item: PlatformProjectItem): MobileCodexTone {
  if (item.row.status === 'permission') {
    return 'attention'
  }
  if (item.working) {
    return 'working'
  }
  return item.unread || item.active ? 'active' : 'idle'
}

function agentTone(row: AgentListRow): MobileCodexTone {
  if (row.stale) {
    return row.unread ? 'active' : 'idle'
  }
  const group = agentStatusGroup(row.dotState)
  if (group === 'needs-you') {
    return 'attention'
  }
  if (group === 'working') {
    return 'working'
  }
  return row.unread ? 'active' : 'idle'
}

export function buildMobileCodexProjectsModel(args: {
  hosts: readonly HostCatalogEntry[]
  worktreeInfo: Readonly<Record<string, HostWorktreeInfo | undefined>>
  hostStates: Readonly<Record<string, ConnectionState>>
  botHomeWorktreeIds: ReadonlySet<string>
  onlyActiveRecent: boolean
  now?: number
}): MobileCodexProjectsModel {
  const now = args.now ?? Date.now()
  const groups = buildPlatformProjectGroups({
    hosts: args.hosts,
    worktreeInfo: args.worktreeInfo,
    botHomeWorktreeIds: args.botHomeWorktreeIds
  })
  const marksByGroupKey = resolveProjectMarks(groups)
  const markByWorktreeKey = new Map<string, { icon: RepoIcon; color: string; repo: string }>()
  const validWorktreeKeys = new Set<string>()
  const hostById = new Map<string, HostCatalogEntry>(args.hosts.map((host) => [host.id, host]))

  const projects: MobileCodexProjectRow[] = groups.map((group) => {
    const mark = marksByGroupKey.get(group.key)!
    let openCount = 0
    let statusTone: MobileCodexTone = 'idle'
    let unread = false
    for (const item of group.items) {
      validWorktreeKeys.add(item.key)
      markByWorktreeKey.set(item.key, { icon: mark.icon, color: mark.color, repo: group.repo })
      openCount += worktreeOpenCount(item.row)
      statusTone = higherTone(statusTone, itemTone(item))
      unread = unread || item.unread
    }
    return {
      key: group.key,
      host: group.host,
      repo: group.repo,
      markIcon: mark.icon,
      markColor: mark.color,
      primaryItem: group.items[0]!,
      items: group.items,
      threads: [],
      openCount,
      statusTone,
      unread,
      lastActivityAt: group.lastActivityAt
    }
  })

  const allRecentRows: MobileCodexRecentRow[] = []
  const worktreeKeysWithAgent = new Set<string>()
  const threadsByWorktreeKey = new Map<string, MobileCodexRecentRow[]>()
  const safeWorktreeInfo: Record<string, HostWorktreeInfo> = {}
  for (const host of args.hosts) {
    const info = args.worktreeInfo[host.id]
    if (info) {
      safeWorktreeInfo[host.id] = info
    }
  }

  for (const host of args.hosts) {
    const hostAgentList = everyRow(
      hostAgents({ hosts: args.hosts, hostStates: args.hostStates, worktreeInfo: safeWorktreeInfo, now }, host.id).roots
    )
    for (const agentRow of hostAgentList) {
      const wtId = agentRow.entry.worktreeId
      if (args.botHomeWorktreeIds.has(wtId) || agentRow.entry.bot) {
        continue
      }
      const wtKey = `${host.id}::${wtId}`
      if (validWorktreeKeys.size > 0 && !validWorktreeKeys.has(wtKey)) {
        const rawRow = args.worktreeInfo[host.id]?.rows?.find((r) => r.worktreeId === wtId)
        if (rawRow && isExcludedMobileBotOrWorkerRow(rawRow, args.botHomeWorktreeIds, args.worktreeInfo[host.id]?.workspaceLineage)) {
          continue
        }
      }
      worktreeKeysWithAgent.add(wtKey)
      const mark = markByWorktreeKey.get(wtKey) ?? {
        icon: { type: 'letters' as const, text: (agentRow.entry.repo || agentRow.entry.workspaceName || '?').slice(0, 2).toUpperCase() },
        color: DEFAULT_REPO_BADGE_COLOR,
        repo: agentRow.entry.repo || agentRow.entry.workspaceName
      }
      const recentRow: MobileCodexRecentRow = {
        key: `agent:${agentRow.key}`,
        kind: 'agent',
        title: agentRow.title,
        projectName: mark.repo,
        host: hostById.get(host.id) ?? host,
        worktreeId: wtId,
        row: null,
        agentRow,
        markIcon: mark.icon,
        markColor: mark.color,
        statusTone: agentTone(agentRow),
        unread: agentRow.unread === true,
        timestamp: agentRow.timeAt
      }
      allRecentRows.push(recentRow)
      const list = threadsByWorktreeKey.get(wtKey)
      if (list) { list.push(recentRow) } else { threadsByWorktreeKey.set(wtKey, [recentRow]) }
    }
  }

  const projectsWithThreads: MobileCodexProjectRow[] = projects.map((project) => {
    const projectThreads = project.items
      .flatMap((item) => threadsByWorktreeKey.get(item.key) ?? [])
      .sort((a, b) => b.timestamp - a.timestamp || a.title.localeCompare(b.title))
    return { ...project, threads: projectThreads }
  })

  for (const project of projects) {
    for (const item of project.items) {
      if (worktreeKeysWithAgent.has(item.key) || (!item.active && !item.working && !item.unread && item.lastActivityAt <= 0)) {
        continue
      }
      allRecentRows.push({
        key: `wt:${item.key}`,
        kind: 'worktree',
        title: item.row.displayName?.trim() || project.repo,
        projectName: project.repo,
        host: item.host,
        worktreeId: item.row.worktreeId,
        row: item.row,
        agentRow: null,
        markIcon: project.markIcon,
        markColor: project.markColor,
        statusTone: itemTone(item),
        unread: item.unread,
        timestamp: item.lastActivityAt
      })
    }
  }

  allRecentRows.sort(
    (a, b) =>
      b.timestamp - a.timestamp ||
      TONE_PRIORITY[b.statusTone] - TONE_PRIORITY[a.statusTone] ||
      a.title.localeCompare(b.title)
  )

  const recentItems = args.onlyActiveRecent
    ? allRecentRows.filter((row) => row.statusTone === 'working' || row.statusTone === 'attention' || row.unread)
    : allRecentRows

  return { projects: projectsWithThreads, recentItems, totalRecentCount: allRecentRows.length }
}
