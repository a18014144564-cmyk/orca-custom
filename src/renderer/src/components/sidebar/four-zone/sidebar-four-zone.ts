import { useCallback, useEffect, useMemo, useRef } from 'react'
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
import {
  getSidebarZoneMode,
  setSidebarZoneMode,
  useSidebarZoneMode
} from './sidebar-zone-store'

export * from './sidebar-four-zone-model'
export {
  getSidebarZoneMode,
  getSidebarZoneOrder,
  resetSidebarZoneOrder,
  setSidebarZoneMode,
  setSidebarZoneOrder,
  useSidebarZoneMode,
  useSidebarZoneOrder
} from './sidebar-zone-store'

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

  const prevClassifiedRef = useRef<{ sig: string; value: ReturnType<typeof classifySidebarHostsByPlatform> } | null>(null)
  const classifiedHosts = useMemo(() => {
    const next = classifySidebarHostsByPlatform({
      hostOptions,
      localPlatform: getRendererAppPlatform(),
      runtimeStatusByEnvironmentId,
      sshConnectionStates
    })
    const sig = `${next.winHostIds.join(',')}|${next.macHostIds.join(',')}|${next.otherHostIds.join(',')}`
    if (prevClassifiedRef.current && prevClassifiedRef.current.sig === sig) {
      return prevClassifiedRef.current.value
    }
    prevClassifiedRef.current = { sig, value: next }
    return next
  }, [hostOptions, runtimeStatusByEnvironmentId, sshConnectionStates])

  const pendingRevealWorktree = useAppStore((s) => s.pendingRevealWorktree)
  const activeWorkspaceExecutionHostId = useAppStore((s) => s.activeWorkspaceExecutionHostId)
  const lastHandledRevealRef = useRef<typeof pendingRevealWorktree>(null)

  // Auto-switch zone AT MOST ONCE per distinct pendingRevealWorktree so clicking another rail button
  // never gets hijacked back if the active sidebar pane hasn't cleared the reveal yet.
  useEffect(() => {
    if (!pendingRevealWorktree || pendingRevealWorktree === lastHandledRevealRef.current) {
      return
    }
    lastHandledRevealRef.current = pendingRevealWorktree
    const rawCurrent = getSidebarZoneMode()
    const currentEffective: SidebarZoneMode =
      !botsEnabled && (rawCurrent === 'teams' || rawCurrent === 'bots') ? 'all' : rawCurrent
    if (currentEffective === 'all') {
      return
    }
    const targetHostId = pendingRevealWorktree.executionHostId ?? activeWorkspaceExecutionHostId
    const nextZone = resolveZoneForWorkspaceHost(
      currentEffective,
      targetHostId,
      classifiedHosts.hostPlatformById
    )
    if (nextZone !== currentEffective) {
      setZoneMode(nextZone)
    }
  }, [
    pendingRevealWorktree,
    activeWorkspaceExecutionHostId,
    botsEnabled,
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
