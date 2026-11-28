import { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../src/shared/execution-host/execution-host'
import type { AgentListRow } from '../../agents/agent-list-rows'
import { botHomeWorktreeId, ensureBotHomeChat } from '../../bots/host-bots-read'
import { botPlaceClient } from '../../bots/use-open-bot-home'
import type { HostCatalogEntry } from '../../host-catalog/host-profile'
import type { FoldablePostureMetrics } from '../../layout/foldable-posture'
import { newWorkspaceOverlayHref } from '../../new-workspace/new-workspace-overlay-route'
import { triggerMediumImpact } from '../../platform/haptics/haptics'
import type { RpcClient } from '../../transport/rpc/rpc-client-contract'
import type { Worktree } from '../../worktree/workspace-list/workspace-list-types'
import type { HomeBotRow } from '../bots/home-bot-rows'
import type { MobileHomeData } from '../use-mobile-home-data'
import type { FiveSlotHomeTabId, FourZoneHomeTabId, HomeTabId } from '../tabs/home-tabs'
import { MobileHomeBotsTab } from '../tabs/MobileHomeBotsTab'
import { MobileHomeProjectsTab } from '../tabs/MobileHomeProjectsTab'
import { MobileHomeRunningTab } from '../tabs/MobileHomeRunningTab'
import { MobileHomeTeamsTab } from '../tabs/MobileHomeTeamsTab'
import { MobileHomeUsageTab } from '../tabs/MobileHomeUsageTab'
import { collectBotHomeWorktreeIds, type MobileProjectsPlatform } from '../tabs/mobile-four-zone'
import { isExcludedMobileBotOrWorkerRow } from '../tabs/mobile-codex-projects'
import { foldableStageHref, type FoldableStageTarget } from './foldable-stage-types'
import { mobileFoldableStyles as styles } from './mobile-foldable-styles'
import { MobileFoldableRail } from './MobileFoldableRail'
import { MobileFoldableStage } from './MobileFoldableStage'
import { MobileFoldableTabletopView } from './MobileFoldableTabletopView'

const EMPTY_CANDIDATES: readonly FoldableStageTarget[] = []

export function MobileFoldableWorkbench(props: {
  foldable: FoldablePostureMetrics
  data: MobileHomeData
  fourZoneTabOrder: readonly FourZoneHomeTabId[]
  activeTab: HomeTabId
  projectsPlatform: MobileProjectsPlatform
  winHosts: HostCatalogEntry[]
  macHosts: HostCatalogEntry[]
  teamsBadge: number
  soloBotsBadge: number
  projectsBadge: number
  runningBadge: number
  canCreateBot: boolean
  stageTarget: FoldableStageTarget | null
  onChangeStageTarget: (next: FoldableStageTarget | null) => void
  clientOf: (pairedHostId: string) => RpcClient | null
  onSelectTab: (tab: FiveSlotHomeTabId) => void
  onLongPressTab: (tab: FourZoneHomeTabId) => void
  onSelectProjectsPlatform: (platform: MobileProjectsPlatform) => void
  onOpenHost: (host: HostCatalogEntry) => void
  onOpenHostActions: (host: HostCatalogEntry) => void
  onOpenNewBot: () => void
  onOpenAccounts: (hostId: string) => void
  onPairDesktop: () => void
  onOpenSettings: () => void
  onToggleClassicLayout: () => void
}) {
  const { foldable, data, stageTarget, onChangeStageTarget } = props
  const [midCollapsed, setMidCollapsed] = useState(false)
  const [splitActive, setSplitActive] = useState(false)
  const [tabletopDismissed, setTabletopDismissed] = useState(false)
  const [visitedMidTabs, setVisitedMidTabs] = useState<ReadonlySet<string>>(
    () => new Set([props.activeTab === 'usage' ? 'projects' : props.activeTab])
  )

  useEffect(() => {
    if (props.activeTab !== 'usage' && !visitedMidTabs.has(props.activeTab)) {
      setVisitedMidTabs((prev) => new Set([...prev, props.activeTab]))
    }
  }, [props.activeTab, visitedMidTabs])

  useEffect(() => {
    if (!foldable.isTabletop && tabletopDismissed) {
      setTabletopDismissed(false)
    }
  }, [foldable.isTabletop, tabletopDismissed])

  useEffect(() => {
    if (stageTarget != null) {
      return
    }
    const firstActive = data.activeAgents[0] ?? data.agentsNeedingYou[0]
    if (firstActive) {
      onChangeStageTarget({
        kind: 'session',
        source: 'project',
        hostId: firstActive.hostId,
        worktreeId: firstActive.entry.worktreeId,
        name: firstActive.entry.workspaceName || firstActive.title,
        paneKey: firstActive.entry.agent.paneKey
      })
    }
  }, [data.activeAgents, data.agentsNeedingYou, onChangeStageTarget, stageTarget])

  // Only build quick-pick candidates when split view is active to avoid wasted work on every WS tick.
  const secondaryCandidates = useMemo<readonly FoldableStageTarget[]>(() => {
    if (!splitActive) {
      return EMPTY_CANDIDATES
    }
    const list: FoldableStageTarget[] = []
    const botHomeIds = collectBotHomeWorktreeIds(data.bots.rows)
    for (const host of data.connectedHosts) {
      const info = data.worktreeInfo[host.id]
      for (const row of info?.rows ?? []) {
        if (isExcludedMobileBotOrWorkerRow(row, botHomeIds, info?.workspaceLineage)) {
          continue
        }
        list.push({
          kind: 'session',
          source: 'project',
          hostId: host.id,
          worktreeId: row.worktreeId,
          name: row.displayName?.trim() || row.repo
        })
      }
    }
    for (const row of data.bots.rows) {
      if (row.offline) {
        continue
      }
      if (row.kind === 'group') {
        list.push({
          kind: 'group',
          hostId: row.pairedHostId,
          groupId: row.group.id,
          worktreeId: botHomeWorktreeId(row.group),
          name: row.group.name
        })
      } else {
        list.push({
          kind: 'session',
          source: 'bot',
          hostId: row.pairedHostId,
          worktreeId: botHomeWorktreeId(row.bot),
          name: row.bot.name,
          ...(row.executionHost !== LOCAL_EXECUTION_HOST_ID
            ? { executionHost: row.executionHost }
            : {})
        })
      }
    }
    return list
  }, [data.bots.rows, data.connectedHosts, data.worktreeInfo, splitActive])

  const handleOpenWorktreeInStage = useCallback(
    (host: HostCatalogEntry, row: Worktree) => {
      if (
        host.credentialStatus === 'missing' ||
        host.credentialStatus === 'temporarily-unavailable'
      ) {
        props.onOpenHost(host)
        return
      }
      onChangeStageTarget({
        kind: 'session',
        source: 'project',
        hostId: host.id,
        worktreeId: row.worktreeId,
        name: row.displayName?.trim() || row.repo
      })
      if (splitActive) {
        setMidCollapsed(true)
      }
    },
    [onChangeStageTarget, props, splitActive]
  )

  const handleOpenAgentInStage = useCallback(
    (row: AgentListRow) => {
      onChangeStageTarget({
        kind: 'session',
        source: 'project',
        hostId: row.hostId,
        worktreeId: row.entry.worktreeId,
        name: row.entry.workspaceName || row.title,
        paneKey: row.entry.agent.paneKey
      })
      if (splitActive) {
        setMidCollapsed(true)
      }
    },
    [onChangeStageTarget, splitActive]
  )

  const handleOpenBotInStage = useCallback(
    (row: HomeBotRow) => {
      if (row.offline) {
        return
      }
      if (row.kind === 'group') {
        // Keep splitActive alive so Team chat works seamlessly in "左聊右看"!
        onChangeStageTarget({
          kind: 'group',
          hostId: row.pairedHostId,
          groupId: row.group.id,
          worktreeId: botHomeWorktreeId(row.group),
          name: row.group.name
        })
        if (splitActive) {
          setMidCollapsed(true)
        }
        return
      }
      const client = props.clientOf(row.pairedHostId)
      const place = { pairedHostId: row.pairedHostId, executionHost: row.executionHost }
      const target: FoldableStageTarget = {
        kind: 'session',
        source: 'bot',
        hostId: row.pairedHostId,
        worktreeId: botHomeWorktreeId(row.bot),
        name: row.bot.name,
        ...(row.executionHost !== LOCAL_EXECUTION_HOST_ID
          ? { executionHost: row.executionHost }
          : {})
      }
      const commit = () => {
        onChangeStageTarget(target)
        if (splitActive) {
          setMidCollapsed(true)
        }
      }
      if (client) {
        void ensureBotHomeChat(botPlaceClient(client, place), row.bot.id).then(commit)
      } else {
        commit()
      }
    },
    [onChangeStageTarget, props, splitActive]
  )

  const handleOpenFullScreen = useCallback(
    (target: FoldableStageTarget) => {
      data.router.push(foldableStageHref(target))
    },
    [data.router]
  )

  const handleNewWorkspace = useCallback(() => {
    const ids = data.connectedHosts.map((host) => host.id)
    if (ids.length > 0) {
      data.router.push(newWorkspaceOverlayHref(ids))
    } else {
      props.onPairDesktop()
    }
  }, [data.connectedHosts, data.router, props])

  if (foldable.isTabletop && !tabletopDismissed) {
    return (
      <MobileFoldableTabletopView
        target={stageTarget}
        activeAgents={data.activeAgents}
        hingeCenter={foldable.hingeCenter}
        screenHeight={foldable.height}
        hingeGap={foldable.hingeGap}
        onSelectAgent={handleOpenAgentInStage}
        onOpenFullScreen={handleOpenFullScreen}
        onNewWorkspace={handleNewWorkspace}
        onExitTabletop={() => setTabletopDismissed(true)}
      />
    )
  }

  const isUsageTab = props.activeTab === 'usage'
  const showMidPane = !isUsageTab && !midCollapsed

  const handleToggleSplit = () => {
    triggerMediumImpact()
    if (isUsageTab) {
      props.onSelectTab('teams')
    }
    setSplitActive((prev) => {
      const next = !prev
      setMidCollapsed(next)
      return next
    })
  }

  const handleToggleMid = () => {
    setMidCollapsed((prev) => !prev)
  }

  return (
    <View style={styles.workbenchRoot}>
      <MobileFoldableRail
        tabs={props.fourZoneTabOrder}
        active={props.activeTab}
        midCollapsed={midCollapsed}
        splitActive={splitActive}
        teamsBadge={props.teamsBadge}
        botsBadge={props.soloBotsBadge}
        projectsBadge={props.projectsBadge}
        runningBadge={props.runningBadge}
        onSelect={(next) => {
          props.onSelectTab(next)
          if (next !== 'usage') {
            setMidCollapsed(false)
          }
        }}
        onLongPressTab={props.onLongPressTab}
        onToggleSplit={handleToggleSplit}
        onToggleMidCollapsed={handleToggleMid}
        onOpenSettings={props.onOpenSettings}
      />

      {isUsageTab ? (
        <View style={styles.stageRoot}>
          <MobileHomeUsageTab
            hosts={data.sortedHosts}
            connectedHosts={data.connectedHosts}
            hostStates={data.hostStates}
            accountsByHost={data.accountsByHost}
            stats={data.stats}
            bottomInset={16}
            onOpenAccounts={props.onOpenAccounts}
          />
        </View>
      ) : null}

      {/* Keep visited mid-pane tabs and the live stage WebView mounted to avoid cold reloads and jank on tab switches. */}
      <View style={isUsageTab ? styles.hidden : [styles.fill, { flexDirection: 'row' }]}>
        <View style={showMidPane ? [styles.midPane, { width: foldable.midPaneWidth }] : styles.hidden}>
          {visitedMidTabs.has('teams') ? (
            <View style={props.activeTab === 'teams' ? styles.fill : styles.hidden}>
              <MobileHomeTeamsTab
                data={data}
                bottomInset={16}
                onOpenBot={handleOpenBotInStage}
                onPairDesktop={props.onPairDesktop}
                onOpenSettings={props.onOpenSettings}
                onToggleClassicLayout={props.onToggleClassicLayout}
              />
            </View>
          ) : null}
          {visitedMidTabs.has('running') ? (
            <View style={props.activeTab === 'running' ? styles.fill : styles.hidden}>
              <MobileHomeRunningTab
                data={data}
                winHosts={props.winHosts}
                macHosts={props.macHosts}
                bottomInset={16}
                selectedTarget={stageTarget}
                onOpenAgent={handleOpenAgentInStage}
                onOpenBot={handleOpenBotInStage}
                onOpenSettings={props.onOpenSettings}
              />
            </View>
          ) : null}
          {visitedMidTabs.has('bots') ? (
            <View style={props.activeTab === 'bots' ? styles.fill : styles.hidden}>
              <MobileHomeBotsTab
                data={data}
                bottomInset={16}
                onNewBot={props.canCreateBot ? props.onOpenNewBot : undefined}
                onOpenBot={handleOpenBotInStage}
                rowKind="bot"
                titleOverride="单独 Bot"
              />
            </View>
          ) : null}
          {visitedMidTabs.has('projects') ||
          (props.activeTab !== 'teams' && props.activeTab !== 'bots' && props.activeTab !== 'running') ? (
            <View
              style={
                props.activeTab !== 'teams' &&
                props.activeTab !== 'bots' &&
                props.activeTab !== 'running' &&
                props.activeTab !== 'usage'
                  ? styles.fill
                  : styles.hidden
              }
            >
              <MobileHomeProjectsTab
                platform={props.projectsPlatform}
                onSelectPlatform={props.onSelectProjectsPlatform}
                data={data}
                winHosts={props.winHosts}
                macHosts={props.macHosts}
                bottomInset={16}
                onOpenHost={props.onOpenHost}
                onOpenHostActions={props.onOpenHostActions}
                onOpenWorktree={handleOpenWorktreeInStage}
                onOpenAgent={handleOpenAgentInStage}
                onPairDesktop={props.onPairDesktop}
                onOpenSettings={props.onOpenSettings}
                onToggleClassicLayout={props.onToggleClassicLayout}
              />
            </View>
          ) : null}
        </View>

        <MobileFoldableStage
          target={stageTarget}
          secondaryCandidates={secondaryCandidates}
          midCollapsed={midCollapsed}
          splitActive={splitActive}
          hingeGap={foldable.hingeGap}
          onToggleMidCollapsed={handleToggleMid}
          onToggleSplit={handleToggleSplit}
          onOpenFullScreen={handleOpenFullScreen}
        />
      </View>
    </View>
  )
}
