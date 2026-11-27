import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AgentListRow } from '../../agents/agent-list-rows'
import { botHomeWorktreeId } from '../../bots/host-bots-read'
import type { HostCatalogEntry, HostProfile } from '../../host-catalog/host-profile'
import type { HostMachineDescriptor } from '../../host-descriptors/host-descriptor-store'
import type { ConnectionState } from '../../transport/connection/connection-state'
import type { HostWorktreeInfo } from '../../worktree/catalog/home-worktree-info'
import { isWorktreeActive } from '../../worktree/workspace-list/workspace-row-filtering'
import type { Worktree } from '../../worktree/workspace-list/workspace-list-types'
import type { HomeBotRow } from '../bots/home-bot-rows'

export type MobileHomeLayoutMode = 'four-zone' | 'classic'
export type MobileHostPlatformBucket = 'win' | 'mac' | 'other'
export type MobileProjectsPlatform = 'win' | 'mac'
export type PlatformConnectionHealth = 'healthy' | 'abnormal'

export const MOBILE_HOME_LAYOUT_STORAGE_KEY = 'orca.custom.mobileHomeLayout'
export const DEFAULT_MOBILE_HOME_LAYOUT: MobileHomeLayoutMode = 'four-zone'
export const MOBILE_PROJECTS_PLATFORM_STORAGE_KEY = 'orca.custom.mobileProjectsPlatform'

export async function loadMobileHomeLayoutMode(): Promise<MobileHomeLayoutMode> {
  try {
    const raw = await AsyncStorage.getItem(MOBILE_HOME_LAYOUT_STORAGE_KEY)
    if (raw === 'classic' || raw === 'four-zone') {
      return raw
    }
  } catch {
    // Fall back to default when storage is unavailable.
  }
  return DEFAULT_MOBILE_HOME_LAYOUT
}

export async function saveMobileHomeLayoutMode(mode: MobileHomeLayoutMode): Promise<void> {
  try {
    await AsyncStorage.setItem(MOBILE_HOME_LAYOUT_STORAGE_KEY, mode)
  } catch {
    // Ignore storage write failures.
  }
}

export async function loadMobileProjectsPlatform(): Promise<MobileProjectsPlatform | null> {
  try {
    const raw = await AsyncStorage.getItem(MOBILE_PROJECTS_PLATFORM_STORAGE_KEY)
    if (raw === 'win' || raw === 'mac') {
      return raw
    }
  } catch {
    // Fall back to default when storage is unavailable.
  }
  return null
}

export async function saveMobileProjectsPlatform(
  platform: MobileProjectsPlatform
): Promise<void> {
  try {
    await AsyncStorage.setItem(MOBILE_PROJECTS_PLATFORM_STORAGE_KEY, platform)
  } catch {
    // Ignore storage write failures.
  }
}

export function normalizeMobilePlatform(
  platform: string | null | undefined
): MobileHostPlatformBucket | null {
  if (!platform) {
    return null
  }
  const normalized = platform.toLowerCase()
  if (normalized === 'win32' || normalized === 'windows') {
    return 'win'
  }
  if (normalized === 'darwin' || normalized === 'macos') {
    return 'mac'
  }
  return 'other'
}

export function inferMobilePlatformFromName(
  name: string | null | undefined
): MobileHostPlatformBucket | null {
  if (!name) {
    return null
  }
  const lower = name.toLowerCase()
  if (
    /(^|[\s._-])(mac|macos|macbook|imac|macstudio|macmini|darwin)($|[\s._-]|book|mini|pro|air|studio)/.test(
      lower
    )
  ) {
    return 'mac'
  }
  if (/(^|[\s._-])(win|windows|win10|win11|pc)($|[\s._-]|10|11)/.test(lower)) {
    return 'win'
  }
  return null
}

export function resolveMobileHostPlatformBucket(
  host: Pick<HostCatalogEntry | HostProfile, 'id' | 'name' | 'lastKnownHostPlatform'>,
  liveDescriptor: HostMachineDescriptor | undefined
): MobileHostPlatformBucket {
  const livePlatform = liveDescriptor?.platform ?? null
  return (
    normalizeMobilePlatform(livePlatform) ??
    normalizeMobilePlatform(host.lastKnownHostPlatform) ??
    inferMobilePlatformFromName(liveDescriptor?.machineName ?? host.name) ??
    'other'
  )
}

export function partitionMobileHostsByPlatform<
  T extends Pick<HostCatalogEntry | HostProfile, 'id' | 'name' | 'lastKnownHostPlatform'>
>(
  hosts: readonly T[],
  descriptors: ReadonlyMap<string, HostMachineDescriptor>
): {
  winHosts: T[]
  macHosts: T[]
  otherHosts: T[]
} {
  const winHosts: T[] = []
  const macHosts: T[] = []
  const otherHosts: T[] = []

  for (const host of hosts) {
    const bucket = resolveMobileHostPlatformBucket(host, descriptors.get(host.id))
    if (bucket === 'win') {
      winHosts.push(host)
    } else if (bucket === 'mac') {
      macHosts.push(host)
    } else {
      otherHosts.push(host)
    }
  }

  return { winHosts, macHosts, otherHosts }
}

export function filterHomeBotRowsByKind(
  rows: readonly HomeBotRow[],
  kind: 'all' | 'group' | 'bot'
): readonly HomeBotRow[] {
  if (kind === 'all') {
    return rows
  }
  return rows.filter((row) => row.kind === kind)
}

export function countBotRowsNeedsYou(rows: readonly HomeBotRow[]): number {
  let total = 0
  for (const row of rows) {
    total += row.needsYou
  }
  return total
}

export function filterAgentRowsByHostIds(
  rows: readonly AgentListRow[],
  hostIds: readonly string[]
): readonly AgentListRow[] {
  if (hostIds.length === 0) {
    return []
  }
  const allowed = new Set(hostIds)
  return rows.filter((row) => allowed.has(row.hostId))
}

export function countNeedsYouForHostIds(
  needsYouByHost: Readonly<Record<string, number>>,
  hostIds: readonly string[]
): number {
  let total = 0
  for (const id of hostIds) {
    total += needsYouByHost[id] ?? 0
  }
  return total
}

/** Healthy (green dot) only when paired hosts exist and all of them are connected; otherwise abnormal (red dot). */
export function resolvePlatformConnectionHealth(
  hosts: readonly Pick<HostCatalogEntry | HostProfile, 'id'>[],
  hostStates: Readonly<Record<string, ConnectionState | undefined>>
): PlatformConnectionHealth {
  if (hosts.length === 0) {
    return 'abnormal'
  }
  return hosts.every((host) => hostStates[host.id] === 'connected') ? 'healthy' : 'abnormal'
}

export function collectBotHomeWorktreeIds(rows: readonly HomeBotRow[]): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const row of rows) {
    if (row.kind === 'bot') {
      ids.add(botHomeWorktreeId(row.bot))
    } else if (row.kind === 'group') {
      ids.add(botHomeWorktreeId(row.group))
    }
  }
  return ids
}

export type PlatformProjectItem = Readonly<{
  key: string
  host: HostCatalogEntry
  row: Worktree
  active: boolean
  working: boolean
  unread: boolean
  lastActivityAt: number
}>

export type PlatformProjectGroup = Readonly<{
  key: string
  host: HostCatalogEntry
  repo: string
  items: readonly PlatformProjectItem[]
  hasAttention: boolean
  lastActivityAt: number
}>

function isWorkingWorktree(row: Worktree): boolean {
  if (row.status === 'working' || row.status === 'permission') {
    return true
  }
  if (Array.isArray(row.agents)) {
    return row.agents.some((agent) => agent.state === 'working' || agent.state === 'blocked')
  }
  return false
}

function rowTimestamp(row: Worktree): number {
  return Math.max(row.lastActivityAt ?? 0, row.lastOutputAt ?? 0, row.createdAt ?? 0)
}

/** Groups non-archived, non-bot worktrees across a platform's paired hosts by repo. */
export function buildPlatformProjectGroups(args: {
  hosts: readonly HostCatalogEntry[]
  worktreeInfo: Readonly<Record<string, HostWorktreeInfo | undefined>>
  botHomeWorktreeIds: ReadonlySet<string>
}): readonly PlatformProjectGroup[] {
  const { hosts, worktreeInfo, botHomeWorktreeIds } = args
  const groupsByKey = new Map<
    string,
    { host: HostCatalogEntry; repo: string; items: PlatformProjectItem[] }
  >()

  for (const host of hosts) {
    const info = worktreeInfo[host.id]
    const rows = info?.rows
    const lineageById = info?.workspaceLineage
    if (!rows || rows.length === 0) {
      continue
    }
    for (const row of rows) {
      const lineage = lineageById?.[row.worktreeId]
      const isBotOrWorkerLineage =
        lineage != null &&
        (lineage.origin === 'orchestration' ||
          lineage.capture?.source === 'bot-hand-over' ||
          Boolean(lineage.orchestrationRunId))
      if (
        row.isArchived === true ||
        row.botHome === true ||
        Boolean(row.bot) ||
        row.repo === 'Bots' ||
        botHomeWorktreeIds.has(row.worktreeId) ||
        isBotOrWorkerLineage
      ) {
        continue
      }
      const repo = row.repo?.trim() || row.displayName?.trim() || 'Workspace'
      const groupKey = `${host.id}\n${repo}`
      let group = groupsByKey.get(groupKey)
      if (!group) {
        group = { host, repo, items: [] }
        groupsByKey.set(groupKey, group)
      }
      group.items.push({
        key: `${host.id}::${row.worktreeId}`,
        host,
        row,
        active: isWorktreeActive(row),
        working: isWorkingWorktree(row),
        unread: row.unread === true,
        lastActivityAt: rowTimestamp(row)
      })
    }
  }

  const groups: PlatformProjectGroup[] = []
  for (const [key, group] of groupsByKey) {
    const items = [...group.items].sort(
      (a, b) =>
        Number(Boolean(b.row.isPinned)) - Number(Boolean(a.row.isPinned)) ||
        Number(b.working) - Number(a.working) ||
        Number(b.unread) - Number(a.unread) ||
        Number(b.active) - Number(a.active) ||
        b.lastActivityAt - a.lastActivityAt ||
        (a.row.displayName || a.row.repo).localeCompare(b.row.displayName || b.row.repo)
    )
    groups.push({
      key,
      host: group.host,
      repo: group.repo,
      items,
      hasAttention: items.some((item) => item.working || item.unread || item.active),
      lastActivityAt: items.reduce((max, item) => Math.max(max, item.lastActivityAt), 0)
    })
  }
  return groups.sort(
    (a, b) =>
      Number(b.hasAttention) - Number(a.hasAttention) ||
      b.lastActivityAt - a.lastActivityAt ||
      a.repo.localeCompare(b.repo)
  )
}

export function countPlatformProjectItems(groups: readonly PlatformProjectGroup[]): number {
  return groups.reduce((sum, group) => sum + group.items.length, 0)
}
