import { useFocusEffect } from 'expo-router'
import { LayoutGrid, Settings } from 'lucide-react-native'
import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, BackHandler, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMobileTranslation } from '../i18n/use-mobile-translation'
import { useOpenMobileAccounts } from '../accounts/use-open-mobile-accounts'
import { ActionSheetModal } from '../components/sheets/ActionSheetModal'
import { ConfirmModal } from '../components/sheets/ConfirmModal'
import { getHostListActionSheetActions } from '../host-list-action-sheet-actions'
import { triggerMediumImpact } from '../platform/haptics/haptics'
import { useAgentListRowActions } from '../agents/use-agent-list-row-actions'
import { useOpenMobileTasks } from '../tasks/use-open-mobile-tasks'
import { useOpenMobileAutomations } from '../automations/use-open-mobile-automations'
import { colors, spacing } from '../theme/mobile-theme'
import { themedStyleSheet } from '../theme/themed-styles'
import { useMobileColorScheme } from '../theme/use-mobile-color-scheme'
import {
  useDisconnectHostClient,
  useForceReconnect,
  useForgetHostClient
} from '../transport/connection/host-client-hooks'
import { hostEndpointLabel } from '../transport/hosts/host-endpoint-label'
import { resolveHomeHostConnectionState } from '../transport/hosts/home-host-auto-connect'
import { removeHostAndCloseClient } from '../host-catalog/host-removal-lifecycle'
import { loadHostCatalog } from '../host-catalog/host-store'
import type { HostCatalogEntry, HostProfile } from '../host-catalog/host-profile'
import { useOpenMobileHostEdit } from '../host-screen/identity/use-open-mobile-host-edit'
import { mobileConnectionPathLabel } from '../transport/connection/mobile-connection-path-label'
import { useMobileHomeData } from './use-mobile-home-data'
import { useHomeSparePage } from './use-home-spare-page'
import { MobileHomeAgentsTab } from './tabs/MobileHomeAgentsTab'
import { MobileHomeAutomationsTab } from './tabs/MobileHomeAutomationsTab'
import { MobileHomeBotsTab } from './tabs/MobileHomeBotsTab'
import { MobileHomeProjectsTab } from './tabs/MobileHomeProjectsTab'
import { MobileHomeTeamsTab } from './tabs/MobileHomeTeamsTab'
import { MobileHomeTabHeaderButton } from './tabs/MobileHomeTabHeader'
import { useMobileFourZoneHome } from './tabs/use-mobile-four-zone'
import type { Worktree } from '../worktree/workspace-list/workspace-list-types'
import { HomeNewBotSheet } from './bots/HomeNewBotSheet'
import { homeNewBotComputers, type HomeBotRow } from './bots/home-bot-rows'
import { useOpenBotHome } from '../bots/use-open-bot-home'
import { MobileHomeFab } from './tabs/MobileHomeFab'
import { MobileHomeFeedTab } from './tabs/MobileHomeFeedTab'
import { MobileHomeTabBar } from './tabs/MobileHomeTabBar'
import { MobileHomeUsageTab } from './tabs/MobileHomeUsageTab'

// The floating button's height plus its gap above the tab bar.
const FAB_CLEARANCE = 56 + spacing.lg

export function MobileHomeScreen() {
  const t = useMobileTranslation()
  useMobileColorScheme()
  const data = useMobileHomeData()
  useHomeSparePage(data.hostCatalogLoaded ? data.sortedHosts.map((host) => host.id) : [])
  const insets = useSafeAreaInsets()
  const openMobileHostEdit = useOpenMobileHostEdit()
  const openMobileTasks = useOpenMobileTasks()
  const openMobileAutomations = useOpenMobileAutomations()
  const openMobileAccounts = useOpenMobileAccounts()
  const disconnectHostClient = useDisconnectHostClient()
  const forgetHostClient = useForgetHostClient()
  const queryClient = useQueryClient()
  const forceReconnectHost = useForceReconnect()
  const [actionTarget, setActionTarget] = useState<HostProfile | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null)
  const zone = useMobileFourZoneHome(data)
  const { layoutMode, activeTabs, defaultTab, tab, visitedTabs, selectTab, toggleLayoutMode } = zone
  const [automationsHostId, setAutomationsHostId] = useState<string | null>(null)
  const [newBotOpen, setNewBotOpen] = useState(false)
  const openBotHome = useOpenBotHome({ standalone: true })
  const [tabBarHeight, setTabBarHeight] = useState(0)
  const agentActions = useAgentListRowActions(
    tabBarHeight,
    data.sortedHosts,
    data.applyAgentActivity
  )

  // Android Back from another tab returns to the primary tab before it leaves the app.
  useFocusEffect(
    useCallback(() => {
      if (tab === defaultTab) {
        return undefined
      }
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        selectTab(defaultTab)
        return true
      })
      return () => subscription.remove()
    }, [defaultTab, selectTab, tab])
  )

  // Stable handlers keep the memoized Feed sections and desktop rows from redrawing on every Home update.
  const { router, setHostCatalog } = data
  const seeAllAgents = useCallback(() => selectTab('agents'), [selectTab])
  const seeAllBots = useCallback(() => selectTab('bots'), [selectTab])

  const openHost = useCallback(
    (host: HostCatalogEntry) => {
      if (host.credentialStatus === 'missing') {
        router.push('/pair-scan')
      } else if (host.credentialStatus === 'temporarily-unavailable') {
        void loadHostCatalog()
          .then(setHostCatalog)
          .catch(() =>
            Alert.alert(
              t('home.screen.pairingCheckFailed', 'Could not check pairing'),
              t('home.screen.tryAgain', 'Please try again.')
            )
          )
      } else {
        router.push(`/h/${host.id}`)
      }
    },
    [router, setHostCatalog, t]
  )

  const openWorktree = useCallback(
    (host: HostCatalogEntry, row: Worktree) => {
      if (host.credentialStatus === 'missing' || host.credentialStatus === 'temporarily-unavailable') {
        openHost(host)
        return
      }
      const name = row.displayName?.trim() || row.repo
      router.push(
        `/h/${encodeURIComponent(host.id)}/session/${encodeURIComponent(row.worktreeId)}?name=${encodeURIComponent(name)}`
      )
    },
    [openHost, router]
  )

  const openHostActions = useCallback((host: HostCatalogEntry) => {
    triggerMediumImpact()
    if (host.profile) {
      setActionTarget(host.profile)
    } else {
      setConfirmRemove(host)
    }
  }, [])

  const openTasks = useCallback((hostId: string) => openMobileTasks(hostId), [openMobileTasks])

  async function handleRemove(): Promise<void> {
    if (!confirmRemove) {
      return
    }
    const host = confirmRemove
    try {
      await removeHostAndCloseClient(host.id, forgetHostClient, queryClient)
      setConfirmRemove(null)
      data.setHostCatalog(await loadHostCatalog())
    } catch {
      setConfirmRemove(host)
      Alert.alert(
        t('home.screen.removeHostFailed', 'Could not remove host'),
        t('home.screen.tryAgain', 'Please try again.')
      )
    }
  }

  const pairDesktop = useCallback(() => router.push('/pair-scan'), [router])
  const openSettings = useCallback(() => router.push('/settings'), [router])
  const openBot = useCallback(
    (row: HomeBotRow) =>
      row.offline
        ? Alert.alert(
            t('bots.list.cantReach', 'Can’t reach {{host}}. Its bots show when it’s back.', {
              host: row.hostLabel
            })
          )
        : row.kind === 'bot'
          ? openBotHome(row, row.bot)
          : router.push(
              `/h/${encodeURIComponent(row.pairedHostId)}/group/${encodeURIComponent(row.group.id)}`
            ),
    [openBotHome, router, t]
  )
  const { bots, allClients } = data
  // + shows only when a connected computer takes a new bot; the tab's lines say why not.
  const canCreateBot = useMemo(
    () => homeNewBotComputers(bots).some((computer) => computer.refusal === undefined),
    [bots]
  )
  const openNewBot = useCallback(() => setNewBotOpen(true), [])
  const clientOf = useCallback(
    (pairedHostId: string) =>
      allClients.find((entry) => entry.hostId === pairedHostId)?.client ?? null,
    [allClients]
  )
  const actionTargetPath = actionTarget ? data.hostConnections[actionTarget.id]?.path : undefined
  const actionTargetConnected =
    actionTarget != null && data.hostStates[actionTarget.id] === 'connected'

  const {
    projectsPlatform,
    selectProjectsPlatform,
    partitionedCatalog,
    teamsBadge,
    soloBotsBadge,
    projectsBadge,
    resolveHomeFab
  } = zone

  const automationsHostConnected =
    automationsHostId != null && data.hostStates[automationsHostId] === 'connected'
  const fab = resolveHomeFab({
    automationsHostId,
    automationsHostConnected,
    newWorkspaceLabel: t('home.bottomBar.newWorkspace', 'New workspace'),
    connectFirstHint: t('home.bottomBar.connectFirst', 'Connect a desktop to start new work.'),
    newAutomationLabel: t('home.automationsTab.newAutomation', 'New automation'),
    onOpenAutomations: (hostId) => openMobileAutomations(hostId, { create: true })
  })
  const contentBottom = spacing.xl + (fab ? FAB_CLEARANCE : 0)
  const fourZoneTrailing = (
    <>
      <MobileHomeTabHeaderButton
        icon={LayoutGrid}
        accessibilityLabel="切换经典视图"
        onPress={toggleLayoutMode}
      />
      <MobileHomeTabHeaderButton
        icon={Settings}
        accessibilityLabel={t('common.settings', 'Settings')}
        onPress={openSettings}
      />
    </>
  )

  return (
    // Agent rows swipe; no gesture root sits above Home.
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.fill}>
          {activeTabs.map((id) =>
            visitedTabs.has(id) ? (
              <View key={id} style={id === tab ? styles.fill : styles.hidden}>
                {id === 'teams' ? (
                  <MobileHomeTeamsTab
                    data={data}
                    bottomInset={contentBottom}
                    onOpenBot={openBot}
                    onPairDesktop={pairDesktop}
                    onOpenSettings={openSettings}
                    onToggleClassicLayout={toggleLayoutMode}
                  />
                ) : id === 'projects' ? (
                  <MobileHomeProjectsTab
                    platform={projectsPlatform}
                    onSelectPlatform={selectProjectsPlatform}
                    data={data}
                    winHosts={partitionedCatalog.winHosts}
                    macHosts={partitionedCatalog.macHosts}
                    bottomInset={contentBottom}
                    onOpenHost={openHost}
                    onOpenHostActions={openHostActions}
                    onOpenWorktree={openWorktree}
                    onPairDesktop={pairDesktop}
                    onOpenSettings={openSettings}
                    onToggleClassicLayout={toggleLayoutMode}
                  />
                ) : id === 'feed' ? (
                  <MobileHomeFeedTab
                    data={data}
                    bottomInset={contentBottom}
                    agentHandlers={agentActions.handlers}
                    onSeeAllAgents={seeAllAgents}
                    onOpenBot={openBot}
                    onSeeAllBots={seeAllBots}
                    onOpenHost={openHost}
                    onOpenHostActions={openHostActions}
                    onPairDesktop={pairDesktop}
                    onOpenTasks={openTasks}
                    onOpenSettings={openSettings}
                  />
                ) : id === 'bots' ? (
                  <MobileHomeBotsTab
                    data={data}
                    bottomInset={contentBottom}
                    onNewBot={canCreateBot ? openNewBot : undefined}
                    onOpenBot={openBot}
                    rowKind={layoutMode === 'four-zone' ? 'bot' : 'all'}
                    titleOverride={layoutMode === 'four-zone' ? '单独 Bot' : undefined}
                    trailingExtra={
                      layoutMode === 'four-zone' ? (
                        fourZoneTrailing
                      ) : (
                        <MobileHomeTabHeaderButton
                          icon={LayoutGrid}
                          accessibilityLabel="切回四区视图"
                          onPress={toggleLayoutMode}
                        />
                      )
                    }
                  />
                ) : id === 'agents' ? (
                  <MobileHomeAgentsTab
                    data={data}
                    bottomInset={contentBottom}
                    handlers={agentActions.handlers}
                  />
                ) : id === 'usage' ? (
                  <MobileHomeUsageTab
                    hosts={data.sortedHosts}
                    connectedHosts={data.connectedHosts}
                    hostStates={data.hostStates}
                    accountsByHost={data.accountsByHost}
                    stats={data.stats}
                    bottomInset={contentBottom}
                    onOpenAccounts={openMobileAccounts}
                    trailingExtra={layoutMode === 'four-zone' ? fourZoneTrailing : undefined}
                  />
                ) : (
                  <MobileHomeAutomationsTab
                    hosts={data.sortedHosts}
                    connectedHosts={data.connectedHosts}
                    hostStates={data.hostStates}
                    bottomInset={contentBottom}
                    onOpenAutomations={(hostId) => openMobileAutomations(hostId)}
                    onHostChange={setAutomationsHostId}
                  />
                )}
              </View>
            ) : null
          )}
        </View>
        <MobileHomeFab
          visible={fab != null}
          disabled={fab?.disabled ?? false}
          accessibilityLabel={fab?.label ?? ''}
          disabledHint={fab?.hint}
          bottom={tabBarHeight + spacing.lg}
          onPress={() => fab?.onPress()}
        />
        <View onLayout={(event) => setTabBarHeight(event.nativeEvent.layout.height)}>
          <MobileHomeTabBar
            tabs={activeTabs}
            active={tab}
            bottomInset={insets.bottom}
            agentsBadge={data.agentsNeedingYou.length}
            botsBadge={layoutMode === 'four-zone' ? soloBotsBadge : data.bots.needsYou}
            teamsBadge={teamsBadge}
            projectsBadge={projectsBadge}
            onSelect={selectTab}
          />
        </View>
        {agentActions.sheet}
        <HomeNewBotSheet
          visible={newBotOpen}
          bots={bots}
          clientOf={clientOf}
          onClose={() => setNewBotOpen(false)}
        />
        <ActionSheetModal
          visible={actionTarget != null}
          title={actionTarget?.name}
          message={
            actionTarget
              ? [
                  actionTargetConnected && actionTargetPath
                    ? mobileConnectionPathLabel(actionTargetPath)
                    : null,
                  hostEndpointLabel(actionTarget.endpoint)
                ]
                  .filter(Boolean)
                  .join(' · ')
              : undefined
          }
          actions={getHostListActionSheetActions({
            host: actionTarget,
            state: actionTarget
              ? resolveHomeHostConnectionState(
                  actionTarget.id,
                  data.hostStates[actionTarget.id],
                  data.autoConnectHostIds
                )
              : 'disconnected',
            hasEverConnected: actionTarget
              ? (data.hostLastConnected[actionTarget.id] ?? null) != null
              : false,
            onDismiss: () => setActionTarget(null),
            onReconnect: (hostId) => void forceReconnectHost?.(hostId),
            onDisconnect: disconnectHostClient,
            onDiagnostics: (hostId) =>
              data.router.push({ pathname: '/connection-log', params: { hostId } }),
            onEdit: openMobileHostEdit,
            onRemove: (host) => setConfirmRemove(host)
          })}
          onClose={() => setActionTarget(null)}
        />
        <ConfirmModal
          visible={confirmRemove != null}
          title={t('home.screen.removeHostTitle', 'Remove Host')}
          message={t('home.screen.removeHostMessage', 'Remove "{{name}}"? You can re-pair later.', {
            name: confirmRemove?.name
          })}
          confirmLabel={t('common.remove', 'Remove')}
          destructive
          onConfirm={() => void handleRemove()}
          onCancel={() => setConfirmRemove(null)}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  )
}

const styles = themedStyleSheet(() => ({
  container: { flex: 1, backgroundColor: colors.bgBase },
  fill: { flex: 1 },
  hidden: { display: 'none' }
}))
