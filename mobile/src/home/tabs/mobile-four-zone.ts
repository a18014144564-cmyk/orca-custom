import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AgentListRow } from '../../agents/agent-list-rows'
import type { HostCatalogEntry, HostProfile } from '../../host-catalog/host-profile'
import type { HostMachineDescriptor } from '../../host-descriptors/host-descriptor-store'
import type { HomeBotRow } from '../bots/home-bot-rows'

export type MobileHomeLayoutMode = 'four-zone' | 'classic'
export type MobileHostPlatformBucket = 'win' | 'mac' | 'other'

export const MOBILE_HOME_LAYOUT_STORAGE_KEY = 'orca.custom.mobileHomeLayout'
export const DEFAULT_MOBILE_HOME_LAYOUT: MobileHomeLayoutMode = 'four-zone'

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
