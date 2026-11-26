import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAllHostDescriptors } from '../../host-descriptors/host-descriptor-store'
import { newWorkspaceOverlayHref } from '../../new-workspace/new-workspace-overlay-route'
import type { MobileHomeData } from '../use-mobile-home-data'
import { CLASSIC_HOME_TABS, FOUR_ZONE_HOME_TABS, type HomeTabId } from './home-tabs'
import {
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

export function useMobileFourZoneHome(data: MobileHomeData) {
  const [layoutMode, setLayoutMode] = useState<MobileHomeLayoutMode>(DEFAULT_MOBILE_HOME_LAYOUT)
  const [tab, setTab] = useState<HomeTabId>('teams')
  const [projectsPlatform, setProjectsPlatform] = useState<MobileProjectsPlatform>('win')
  const [platformLoaded, setPlatformLoaded] = useState(false)
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<HomeTabId>>(
    () => new Set<HomeTabId>(['teams'])
  )
  const hostDescriptors = useAllHostDescriptors()

  const activeTabs: readonly HomeTabId[] =
    layoutMode === 'four-zone' ? FOUR_ZONE_HOME_TABS : CLASSIC_HOME_TABS
  const defaultTab: HomeTabId = layoutMode === 'four-zone' ? 'teams' : 'feed'

  useEffect(() => {
    let active = true
    void loadMobileHomeLayoutMode().then((storedMode) => {
      if (!active || storedMode === DEFAULT_MOBILE_HOME_LAYOUT) {
        return
      }
      setLayoutMode(storedMode)
      const firstTab: HomeTabId = storedMode === 'four-zone' ? 'teams' : 'feed'
      setTab(firstTab)
      setVisitedTabs((prev) => (prev.has(firstTab) ? prev : new Set([...prev, firstTab])))
    })
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
    setTab(next)
    setVisitedTabs((visited) => (visited.has(next) ? visited : new Set([...visited, next])))
  }, [])

  const selectProjectsPlatform = useCallback((next: MobileProjectsPlatform) => {
    setProjectsPlatform(next)
    void saveMobileProjectsPlatform(next)
  }, [])

  const toggleLayoutMode = useCallback(() => {
    setLayoutMode((prev) => {
      const next: MobileHomeLayoutMode = prev === 'four-zone' ? 'classic' : 'four-zone'
      void saveMobileHomeLayoutMode(next)
      const nextTab: HomeTabId = next === 'four-zone' ? 'teams' : 'feed'
      setTab(nextTab)
      setVisitedTabs((visited) => (visited.has(nextTab) ? visited : new Set([...visited, nextTab])))
      return next
    })
  }, [])

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
    resolveHomeFab
  }
}
