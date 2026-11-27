import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAllHostDescriptors } from '../../host-descriptors/host-descriptor-store'
import { newWorkspaceOverlayHref } from '../../new-workspace/new-workspace-overlay-route'
import type { MobileHomeData } from '../use-mobile-home-data'
import {
  buildFiveSlotMobileTabs,
  CLASSIC_HOME_TABS,
  FOUR_ZONE_HOME_TABS,
  type FourZoneHomeTabId,
  type HomeTabId
} from './home-tabs'
import {
  collectBotHomeWorktreeIds,
  countBotRowsNeedsYou,
  countNeedsYouForHostIds,
  DEFAULT_MOBILE_HOME_LAYOUT,
  filterHomeBotRowsByKind,
  loadMobileHomeLayoutMode,
  loadMobileProjectsPlatform,
  partitionMobileHostsByPlatform,
  saveMobileHomeLayoutMode,
  saveMobileProjectsPlatform,
  type MobileHomeLayoutMode,
  type MobileProjectsPlatform
} from './mobile-four-zone'
import { countActiveMobileRunningWindows } from './mobile-running-windows'
import {
  loadMobileFourZoneTabOrder,
  normalizeMobileFourZoneTabOrder,
  saveMobileFourZoneTabOrder
} from './mobile-tab-order'

export function useMobileFourZoneHome(data: MobileHomeData) {
  const [layoutMode, setLayoutMode] = useState<MobileHomeLayoutMode>(DEFAULT_MOBILE_HOME_LAYOUT)
  const [fourZoneTabOrder, setFourZoneTabOrder] = useState<FourZoneHomeTabId[]>([
    ...FOUR_ZONE_HOME_TABS
  ])
  const [tab, setTab] = useState<HomeTabId>('teams')
  const userPickedTabRef = useRef(false)
  const [projectsPlatform, setProjectsPlatform] = useState<MobileProjectsPlatform>('win')
  const [platformLoaded, setPlatformLoaded] = useState(false)
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<HomeTabId>>(
    () => new Set<HomeTabId>(['teams'])
  )
  const hostDescriptors = useAllHostDescriptors()

  const activeTabs: readonly HomeTabId[] = useMemo(
    () => (layoutMode === 'four-zone' ? buildFiveSlotMobileTabs(fourZoneTabOrder) : CLASSIC_HOME_TABS),
    [fourZoneTabOrder, layoutMode]
  )
  const defaultTab: HomeTabId = layoutMode === 'four-zone' ? fourZoneTabOrder[0]! : 'feed'

  useEffect(() => {
    let active = true
    void Promise.all([loadMobileHomeLayoutMode(), loadMobileFourZoneTabOrder()]).then(
      ([storedMode, storedOrder]) => {
        if (!active) {
          return
        }
        setFourZoneTabOrder(storedOrder)
        setLayoutMode(storedMode)
        if (!userPickedTabRef.current) {
          const firstTab: HomeTabId = storedMode === 'four-zone' ? storedOrder[0]! : 'feed'
          setTab(firstTab)
          setVisitedTabs((prev) => (prev.has(firstTab) ? prev : new Set([...prev, firstTab])))
        }
      }
    )
    void loadMobileProjectsPlatform().then((storedPlatform) => {
      if (!active) {
        return
      }
      if (storedPlatform) {
        setProjectsPlatform(storedPlatform)
      }
      setPlatformLoaded(true)
    })
    return () => {
      active = false
    }
  }, [])

  const selectTab = useCallback((next: HomeTabId) => {
    userPickedTabRef.current = true
    setTab(next)
    setVisitedTabs((visited) => (visited.has(next) ? visited : new Set([...visited, next])))
  }, [])

  const reorderFourZoneTabs = useCallback((next: readonly FourZoneHomeTabId[]) => {
    const normalized = normalizeMobileFourZoneTabOrder(next)
    setFourZoneTabOrder(normalized)
    void saveMobileFourZoneTabOrder(normalized)
  }, [])

  const resetFourZoneTabOrder = useCallback(() => {
    const defaults = [...FOUR_ZONE_HOME_TABS]
    setFourZoneTabOrder(defaults)
    void saveMobileFourZoneTabOrder(defaults)
  }, [])

  const selectProjectsPlatform = useCallback((next: MobileProjectsPlatform) => {
    setProjectsPlatform(next)
    void saveMobileProjectsPlatform(next)
  }, [])

  const toggleLayoutMode = useCallback(() => {
    setLayoutMode((prev) => {
      const next: MobileHomeLayoutMode = prev === 'four-zone' ? 'classic' : 'four-zone'
      void saveMobileHomeLayoutMode(next)
      const nextTab: HomeTabId = next === 'four-zone' ? fourZoneTabOrder[0]! : 'feed'
      setTab(nextTab)
      setVisitedTabs((visited) => (visited.has(nextTab) ? visited : new Set([...visited, nextTab])))
      return next
    })
  }, [fourZoneTabOrder])

  const partitionedCatalog = useMemo(
    () => partitionMobileHostsByPlatform(data.sortedHostCatalog, hostDescriptors),
    [data.sortedHostCatalog, hostDescriptors]
  )
  const partitionedProfiles = useMemo(
    () => partitionMobileHostsByPlatform(data.sortedHosts, hostDescriptors),
    [data.sortedHosts, hostDescriptors]
  )
  const connectedWinHosts = useMemo(
    () => partitionedProfiles.winHosts.filter((host) => data.hostStates[host.id] === 'connected'),
    [data.hostStates, partitionedProfiles.winHosts]
  )
  const connectedMacHosts = useMemo(
    () => partitionedProfiles.macHosts.filter((host) => data.hostStates[host.id] === 'connected'),
    [data.hostStates, partitionedProfiles.macHosts]
  )
  const teamsBadge = useMemo(
    () => countBotRowsNeedsYou(filterHomeBotRowsByKind(data.bots.rows, 'group')),
    [data.bots.rows]
  )
  const soloBotsBadge = useMemo(
    () => countBotRowsNeedsYou(filterHomeBotRowsByKind(data.bots.rows, 'bot')),
    [data.bots.rows]
  )
  const winBadge = useMemo(
    () =>
      countNeedsYouForHostIds(
        data.needsYouByHost,
        partitionedCatalog.winHosts.map((host) => host.id)
      ),
    [data.needsYouByHost, partitionedCatalog.winHosts]
  )
  const macBadge = useMemo(
    () =>
      countNeedsYouForHostIds(
        data.needsYouByHost,
        partitionedCatalog.macHosts.map((host) => host.id)
      ),
    [data.needsYouByHost, partitionedCatalog.macHosts]
  )
  const projectsBadge = winBadge + macBadge
  const botHomeWorktreeIds = useMemo(
    () => collectBotHomeWorktreeIds(data.bots.rows),
    [data.bots.rows]
  )
  const runningBadge = useMemo(
    () =>
      countActiveMobileRunningWindows({
        hosts: data.sortedHostCatalog,
        hostStates: data.hostStates,
        worktreeInfo: data.worktreeInfo,
        botRows: data.bots.rows,
        botHomeWorktreeIds
      }),
    [botHomeWorktreeIds, data.bots.rows, data.hostStates, data.sortedHostCatalog, data.worktreeInfo]
  )

  useEffect(() => {
    if (!platformLoaded || !data.hostCatalogLoaded) {
      return
    }
    if (
      projectsPlatform === 'win' &&
      partitionedCatalog.winHosts.length === 0 &&
      partitionedCatalog.macHosts.length > 0
    ) {
      setProjectsPlatform('mac')
    }
  }, [
    data.hostCatalogLoaded,
    partitionedCatalog.macHosts.length,
    partitionedCatalog.winHosts.length,
    platformLoaded,
    projectsPlatform
  ])

  const { router } = data
  const paired = data.hostCatalogLoaded && data.hostCatalog.length > 0

  const resolveHomeFab = (args: {
    automationsHostId: string | null
    automationsHostConnected: boolean
    newWorkspaceLabel: string
    connectFirstHint: string
    newAutomationLabel: string
    onOpenAutomations: (hostId: string) => void
  }) => {
    if (tab === 'feed' && paired) {
      return {
        label: args.newWorkspaceLabel,
        disabled: data.connectedHosts.length === 0,
        hint: data.hostsConnecting ? undefined : args.connectFirstHint,
        onPress: () =>
          router.push(newWorkspaceOverlayHref(data.connectedHosts.map((host) => host.id)))
      }
    }
    if (tab === 'projects') {
      const targetCatalog =
        projectsPlatform === 'win' ? partitionedCatalog.winHosts : partitionedCatalog.macHosts
      const targetConnected =
        projectsPlatform === 'win' ? connectedWinHosts : connectedMacHosts
      if (targetCatalog.length > 0) {
        return {
          label: args.newWorkspaceLabel,
          disabled: targetConnected.length === 0,
          hint: data.hostsConnecting
            ? undefined
            : projectsPlatform === 'win'
              ? '先连接 Windows 主机再新建工作区。'
              : '先连接 Mac 主机再新建工作区。',
          onPress: () =>
            router.push(newWorkspaceOverlayHref(targetConnected.map((host) => host.id)))
        }
      }
    }
    if (tab === 'automations' && args.automationsHostId && args.automationsHostConnected) {
      const hostId = args.automationsHostId
      return {
        label: args.newAutomationLabel,
        disabled: false,
        hint: undefined,
        onPress: () => args.onOpenAutomations(hostId)
      }
    }
    return null
  }

  return {
    layoutMode,
    fourZoneTabOrder,
    reorderFourZoneTabs,
    resetFourZoneTabOrder,
    activeTabs,
    defaultTab,
    tab,
    visitedTabs,
    selectTab,
    toggleLayoutMode,
    projectsPlatform,
    selectProjectsPlatform,
    partitionedCatalog,
    partitionedProfiles,
    teamsBadge,
    soloBotsBadge,
    projectsBadge,
    runningBadge,
    resolveHomeFab
  }
}
