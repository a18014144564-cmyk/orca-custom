import { useCallback, useEffect, useMemo } from 'react'
import { useAppStore } from '@/store'
import { useRuntimeStatusByEnvironmentId } from '@/store/slices/runtime-status/views/use-runtime-status-view'
import { getRendererAppPlatform } from '@/app-shell/platform/renderer-app-platform'
import { useBots } from '@/lib/bot-catalog'
import { useBotGroups } from '@/lib/bot-group-list'
import { useSidebarHostScopeOptions } from '../worktree-list/controls/use-sidebar-host-scope-options'
import {
  classifySidebarHostsByPlatform,
  resolveZoneForWorkspaceHost,
  resolveZoneHostIdsOverride,
  type SidebarZoneMode
} from './sidebar-four-zone-model'
import { setSidebarZoneMode, useSidebarZoneMode } from './sidebar-zone-store'

export * from './sidebar-four-zone-model'
export { getSidebarZoneMode, setSidebarZoneMode, useSidebarZoneMode } from './sidebar-zone-store'

export function useSidebarFourZone(botsEnabled: boolean) {
  const zoneMode = useSidebarZoneMode()
  const { hostOptions } = useSidebarHostScopeOptions()
  const runtimeStatusByEnvironmentId = useRuntimeStatusByEnvironmentId()
  const sshConnectionStates = useAppStore((s) => s.sshConnectionStates)
  const bots = useBots(botsEnabled)
  const groups = useBotGroups(botsEnabled)

  const setZoneMode = useCallback((next: SidebarZoneMode) => {
    setSidebarZoneMode(next)
  }, [])

  // If bots are disabled globally, fall back cleanly so the sidebar never shows an empty dead zone.
  const effectiveZoneMode: SidebarZoneMode =
    !botsEnabled && (zoneMode === 'teams' || zoneMode === 'bots') ? 'all' : zoneMode

  const classifiedHosts = useMemo(
    () =>
      classifySidebarHostsByPlatform({
        hostOptions,
        localPlatform: getRendererAppPlatform(),
        runtimeStatusByEnvironmentId,
        sshConnectionStates
      }),
    [hostOptions, runtimeStatusByEnvironmentId, sshConnectionStates]
  )

  const pendingRevealWorktree = useAppStore((s) => s.pendingRevealWorktree)
  const activeWorkspaceExecutionHostId = useAppStore((s) => s.activeWorkspaceExecutionHostId)

  // Auto-switch zone when a reveal request targets a workspace outside the currently selected zone.
  useEffect(() => {
    if (!pendingRevealWorktree || effectiveZoneMode === 'all') {
      return
    }
    const nextZone = resolveZoneForWorkspaceHost(
      effectiveZoneMode,
      activeWorkspaceExecutionHostId,
      classifiedHosts.hostPlatformById
    )
    if (nextZone !== effectiveZoneMode) {
      setZoneMode(nextZone)
    }
  }, [
    pendingRevealWorktree,
    activeWorkspaceExecutionHostId,
    effectiveZoneMode,
    classifiedHosts.hostPlatformById,
    setZoneMode
  ])

  const hostIdsOverride = useMemo(
    () => resolveZoneHostIdsOverride(effectiveZoneMode, classifiedHosts, null),
    [effectiveZoneMode, classifiedHosts]
  )

  return {
    zoneMode: effectiveZoneMode,
    setZoneMode,
    classifiedHosts,
    hostIdsOverride,
    teamCount: groups.length,
    botCount: bots.length
  }
}
