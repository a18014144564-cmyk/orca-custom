import type { SidebarHostOption } from '../worktree-list/controls/sidebar-host-options'
import type { ExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import type { RuntimeEnvironmentStatus } from '../../../../../shared/remote-runtime/host-status/runtime-host-status'
import type { SshConnectionState } from '../../../../../shared/remote-runtime/ssh/ssh-types'

export type SidebarZoneMode = 'teams' | 'bots' | 'win' | 'mac' | 'all'
export type HostPlatformBucket = 'win' | 'mac' | 'other'

export const SIDEBAR_ZONE_STORAGE_KEY = 'orca.custom.sidebarZoneMode'
export const DEFAULT_SIDEBAR_ZONE_MODE: SidebarZoneMode = 'teams'

const VALID_ZONE_MODES: ReadonlySet<string> = new Set(['teams', 'bots', 'win', 'mac', 'all'])

export function readStoredSidebarZoneMode(): SidebarZoneMode {
  if (typeof window === 'undefined') {
    return DEFAULT_SIDEBAR_ZONE_MODE
  }
  try {
    const raw = window.localStorage.getItem(SIDEBAR_ZONE_STORAGE_KEY)
    if (raw && VALID_ZONE_MODES.has(raw)) {
      return raw as SidebarZoneMode
    }
  } catch {
    // Ignore storage read failures in restricted environments.
  }
  return DEFAULT_SIDEBAR_ZONE_MODE
}

export function writeStoredSidebarZoneMode(mode: SidebarZoneMode): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(SIDEBAR_ZONE_STORAGE_KEY, mode)
  } catch {
    // Ignore storage write failures.
  }
}

export function platformToBucket(platform: string | null | undefined): HostPlatformBucket | null {
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

/** Fallback heuristic when a paired host is temporarily offline and has no live status yet. */
export function inferPlatformBucketFromLabel(
  label: string | null | undefined
): HostPlatformBucket | null {
  if (!label) {
    return null
  }
  const lower = label.toLowerCase()
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

function decodeHostSuffix(hostId: ExecutionHostId, prefix: 'runtime:' | 'ssh:'): string | null {
  if (!hostId.startsWith(prefix)) {
    return null
  }
  try {
    return decodeURIComponent(hostId.slice(prefix.length))
  } catch {
    return hostId.slice(prefix.length)
  }
}

export type ClassifiedSidebarHosts = {
  winHostIds: ExecutionHostId[]
  macHostIds: ExecutionHostId[]
  otherHostIds: ExecutionHostId[]
  hostPlatformById: Map<ExecutionHostId, HostPlatformBucket>
  winHostCount: number
  macHostCount: number
}

export function classifySidebarHostsByPlatform(args: {
  hostOptions: readonly Pick<
    SidebarHostOption,
    'id' | 'kind' | 'label' | 'wslDistro' | 'aliasHostIds' | 'mergedIntoHostId'
  >[]
  localPlatform: string
  runtimeStatusByEnvironmentId?: ReadonlyMap<string, RuntimeEnvironmentStatus>
  sshConnectionStates?: ReadonlyMap<string, SshConnectionState>
}): ClassifiedSidebarHosts {
  const winSet = new Set<ExecutionHostId>()
  const macSet = new Set<ExecutionHostId>()
  const otherSet = new Set<ExecutionHostId>()
  const hostPlatformById = new Map<ExecutionHostId, HostPlatformBucket>()
  let winHostCount = 0
  let macHostCount = 0

  for (const host of args.hostOptions) {
    if (host.mergedIntoHostId) {
      continue
    }
    let bucket: HostPlatformBucket | null = null
    if (host.kind === 'local') {
      bucket = platformToBucket(args.localPlatform) ?? 'other'
    } else if (host.kind === 'runtime') {
      if (host.wslDistro) {
        bucket = 'win'
      } else {
        const envId = decodeHostSuffix(host.id, 'runtime:')
        const statusEntry = envId ? args.runtimeStatusByEnvironmentId?.get(envId) : undefined
        const livePlatform =
          statusEntry?.status?.hostPlatform ?? statusEntry?.snapshot?.status?.hostPlatform ?? null
        bucket =
          platformToBucket(livePlatform) ?? inferPlatformBucketFromLabel(host.label) ?? 'other'
      }
    } else if (host.kind === 'ssh') {
      const targetId = decodeHostSuffix(host.id, 'ssh:')
      const remotePlatform = targetId
        ? args.sshConnectionStates?.get(targetId)?.remotePlatform
        : null
      bucket =
        platformToBucket(remotePlatform) ?? inferPlatformBucketFromLabel(host.label) ?? 'other'
    } else {
      bucket = 'other'
    }

    const ids: ExecutionHostId[] = [host.id, ...(host.aliasHostIds ?? [])]
    if (bucket === 'win') {
      winHostCount += 1
      for (const id of ids) {
        winSet.add(id)
        hostPlatformById.set(id, 'win')
      }
    } else if (bucket === 'mac') {
      macHostCount += 1
      for (const id of ids) {
        macSet.add(id)
        hostPlatformById.set(id, 'mac')
      }
    } else {
      for (const id of ids) {
        otherSet.add(id)
        hostPlatformById.set(id, 'other')
      }
    }
  }

  return {
    winHostIds: [...winSet],
    macHostIds: [...macSet],
    otherHostIds: [...otherSet],
    hostPlatformById,
    winHostCount,
    macHostCount
  }
}

export function resolveZoneHostIdsOverride(
  mode: SidebarZoneMode,
  classified: Pick<ClassifiedSidebarHosts, 'winHostIds' | 'macHostIds'>,
  userVisibleHostIds: readonly ExecutionHostId[] | null | undefined
): ExecutionHostId[] | null {
  if (mode !== 'win' && mode !== 'mac') {
    return null
  }
  const zoneIds = mode === 'win' ? classified.winHostIds : classified.macHostIds
  if (!userVisibleHostIds) {
    return zoneIds
  }
  const allowed = new Set(userVisibleHostIds)
  return zoneIds.filter((id) => allowed.has(id))
}

export function resolveZoneForWorkspaceHost(
  currentMode: SidebarZoneMode,
  hostId: ExecutionHostId | null | undefined,
  hostPlatformById: ReadonlyMap<ExecutionHostId, HostPlatformBucket>
): SidebarZoneMode {
  if (currentMode === 'all' || !hostId) {
    return currentMode
  }
  const bucket = hostPlatformById.get(hostId)
  if (bucket === 'win') {
    return 'win'
  }
  if (bucket === 'mac') {
    return 'mac'
  }
  return 'all'
}
