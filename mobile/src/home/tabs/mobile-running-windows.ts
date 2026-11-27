import { agentStatusGroup, everyRow, hostAgents, type AgentListRow } from '../../agents/agent-list-rows'
import type { HostCatalogEntry } from '../../host-catalog/host-profile'
import type { ConnectionState } from '../../transport/connection/connection-state'
import type { HostWorktreeInfo } from '../../worktree/catalog/home-worktree-info'
import type { HomeBotRow } from '../bots/home-bot-rows'
import { formatMobileRelativeTime, isExcludedMobileBotOrWorkerRow } from './mobile-codex-projects'
import type { MobileRunningWindowsPrefs } from './mobile-running-prefs'

export * from './mobile-running-prefs'

export type MobileRunningDevicePlatform = 'win' | 'mac' | 'other'
export type MobileRunningWindowKind = 'project' | 'bot' | 'team'
export type MobileRunningWindowStatus = 'attention' | 'working' | 'idle'

export type MobileRunningWindowItem = Readonly<{
  key: string
  kind: MobileRunningWindowKind
  status: MobileRunningWindowStatus
  title: string
  subtitle: string
  hostId: string
  deviceName: string
  platform: MobileRunningDevicePlatform
  lastActivityAt: number
  unread: boolean
  agentRow?: AgentListRow
  botRow?: HomeBotRow
}>

export type MobileRunningDeviceGroup = Readonly<{
  hostId: string
  deviceName: string
  platform: MobileRunningDevicePlatform
  items: readonly MobileRunningWindowItem[]
  activeCount: number
}>

export type MobileRunningWindowsModel = Readonly<{
  items: readonly MobileRunningWindowItem[]
  groupedByDevice: readonly MobileRunningDeviceGroup[]
  activeCount: number
  idleCount: number
}>

const STATUS_RANK: Record<MobileRunningWindowStatus, number> = { attention: 2, working: 1, idle: 0 }

function compareItems(a: MobileRunningWindowItem, b: MobileRunningWindowItem): number {
  return (
    STATUS_RANK[b.status] - STATUS_RANK[a.status] ||
    b.lastActivityAt - a.lastActivityAt ||
    a.title.localeCompare(b.title)
  )
}

function shouldKeepWindow(
  item: Pick<MobileRunningWindowItem, 'key' | 'status' | 'lastActivityAt'>,
  prefs: MobileRunningWindowsPrefs,
  now: number
): boolean {
  if (item.status === 'attention' || item.status === 'working') {
    return true
  }
  if (!Number.isFinite(item.lastActivityAt) || item.lastActivityAt <= 0) {
    return false
  }
  const dismissedAt = prefs.dismissedAtByKey[item.key]
  if (dismissedAt !== undefined && item.lastActivityAt <= dismissedAt + 1000) {
    return false
  }
  if (prefs.idleHideMs === null) {
    return true
  }
  if (prefs.idleHideMs === 0) {
    return false
  }
  return now - item.lastActivityAt < prefs.idleHideMs
}

export function countActiveMobileRunningWindows(args: {
  hosts: readonly HostCatalogEntry[]
  hostStates: Readonly<Record<string, ConnectionState>>
  worktreeInfo: Readonly<Record<string, HostWorktreeInfo | undefined>>
  botRows: readonly HomeBotRow[]
  botHomeWorktreeIds: ReadonlySet<string>
  now?: number
}): number {
  const now = args.now ?? Date.now()
  let count = 0
  const safeWorktreeInfo: Record<string, HostWorktreeInfo> = {}
  for (const host of args.hosts) {
    const info = args.worktreeInfo[host.id]
    if (info) { safeWorktreeInfo[host.id] = info }
  }
  for (const host of args.hosts) {
    const agentRows = everyRow(
      hostAgents({ hosts: args.hosts, hostStates: args.hostStates, worktreeInfo: safeWorktreeInfo, now }, host.id).roots
    )
    for (const agentRow of agentRows) {
      const wtId = agentRow.entry.worktreeId
      if (args.botHomeWorktreeIds.has(wtId) || agentRow.entry.bot || agentRow.stale) { continue }
      const group = agentStatusGroup(agentRow.dotState)
      if (group !== 'working' && group !== 'needs-you') { continue }
      const rawRow = args.worktreeInfo[host.id]?.rows?.find((r) => r.worktreeId === wtId)
      if (rawRow && isExcludedMobileBotOrWorkerRow(rawRow, args.botHomeWorktreeIds, args.worktreeInfo[host.id]?.workspaceLineage)) { continue }
      count += 1
    }
  }
  for (const row of args.botRows) {
    if (!row.offline && (row.needsYou > 0 || row.dot === 'permission' || row.dot === 'working')) {
      count += 1
    }
  }
  return count
}

export function buildMobileRunningWindows(args: {
  hosts: readonly HostCatalogEntry[]
  winHostIds: ReadonlySet<string>
  macHostIds: ReadonlySet<string>
  hostStates: Readonly<Record<string, ConnectionState>>
  worktreeInfo: Readonly<Record<string, HostWorktreeInfo | undefined>>
  botRows: readonly HomeBotRow[]
  botHomeWorktreeIds: ReadonlySet<string>
  prefs: MobileRunningWindowsPrefs
  now?: number
}): MobileRunningWindowsModel {
  const now = args.now ?? Date.now()
  const platformOf = (hostId: string): MobileRunningDevicePlatform =>
    args.winHostIds.has(hostId) ? 'win' : args.macHostIds.has(hostId) ? 'mac' : 'other'

  const safeWorktreeInfo: Record<string, HostWorktreeInfo> = {}
  for (const host of args.hosts) {
    const info = args.worktreeInfo[host.id]
    if (info) { safeWorktreeInfo[host.id] = info }
  }

  const rawItems: MobileRunningWindowItem[] = []

  for (const host of args.hosts) {
    const agentRows = everyRow(
      hostAgents({ hosts: args.hosts, hostStates: args.hostStates, worktreeInfo: safeWorktreeInfo, now }, host.id).roots
    )
    for (const agentRow of agentRows) {
      const wtId = agentRow.entry.worktreeId
      if (args.botHomeWorktreeIds.has(wtId) || agentRow.entry.bot) { continue }
      const rawRow = args.worktreeInfo[host.id]?.rows?.find((r) => r.worktreeId === wtId)
      if (rawRow && isExcludedMobileBotOrWorkerRow(rawRow, args.botHomeWorktreeIds, args.worktreeInfo[host.id]?.workspaceLineage)) { continue }
      const group = agentRow.stale ? 'done' : agentStatusGroup(agentRow.dotState)
      const status: MobileRunningWindowStatus =
        group === 'needs-you' ? 'attention' : group === 'working' ? 'working' : 'idle'
      const item: MobileRunningWindowItem = {
        key: `proj:${agentRow.key}`,
        kind: 'project',
        status,
        title: agentRow.title,
        subtitle: agentRow.entry.repo || agentRow.entry.workspaceName || '项目',
        hostId: host.id,
        deviceName: host.name,
        platform: platformOf(host.id),
        lastActivityAt: agentRow.timeAt,
        unread: agentRow.unread === true,
        agentRow
      }
      if (shouldKeepWindow(item, args.prefs, now)) { rawItems.push(item) }
    }
  }

  for (const row of args.botRows) {
    const status: MobileRunningWindowStatus = row.offline
      ? 'idle'
      : row.needsYou > 0 || row.dot === 'permission'
        ? 'attention'
        : row.dot === 'working'
          ? 'working'
          : 'idle'
    const item: MobileRunningWindowItem = {
      key: `bot:${row.key}`,
      kind: row.kind === 'group' ? 'team' : 'bot',
      status,
      title: row.title,
      subtitle: row.preview.trim() || (row.kind === 'group' ? 'Bot 团队' : '单独 Bot'),
      hostId: row.pairedHostId,
      deviceName: row.hostLabel,
      platform: platformOf(row.pairedHostId),
      lastActivityAt: row.activityAt,
      unread: row.unread,
      botRow: row
    }
    if (shouldKeepWindow(item, args.prefs, now)) { rawItems.push(item) }
  }

  rawItems.sort(compareItems)

  let activeCount = 0
  let idleCount = 0
  const byHost = new Map<string, { deviceName: string; platform: MobileRunningDevicePlatform; items: MobileRunningWindowItem[]; activeCount: number }>()
  for (const item of rawItems) {
    const isRunning = item.status === 'attention' || item.status === 'working'
    if (isRunning) { activeCount += 1 } else { idleCount += 1 }
    const bucket = byHost.get(item.hostId)
    if (bucket) {
      bucket.items.push(item)
      if (isRunning) { bucket.activeCount += 1 }
    } else {
      byHost.set(item.hostId, {
        deviceName: item.deviceName,
        platform: item.platform,
        items: [item],
        activeCount: isRunning ? 1 : 0
      })
    }
  }

  const groupedByDevice: MobileRunningDeviceGroup[] = [...byHost.entries()]
    .map(([hostId, g]) => ({ hostId, ...g }))
    .sort((a, b) => b.activeCount - a.activeCount || (b.items[0]?.lastActivityAt ?? 0) - (a.items[0]?.lastActivityAt ?? 0))

  return { items: rawItems, groupedByDevice, activeCount, idleCount }
}

export function formatRunningWindowAge(item: Pick<MobileRunningWindowItem, 'status' | 'lastActivityAt'>, now: number = Date.now()): string {
  if (item.status === 'attention') { return '待确认' }
  if (item.status === 'working') { return '运行中' }
  const rel = formatMobileRelativeTime(item.lastActivityAt, now)
  return rel ? `空闲 ${rel}` : '空闲'
}
