import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../src/shared/execution-host/execution-host'
import type { AgentListRow } from '../../agents/agent-list-rows'
import { botHomeWorktreeId, ensureBotHomeChat } from '../../bots/host-bots-read'
import { botPlaceClient } from '../../bots/use-open-bot-home'
import type { HostCatalogEntry } from '../../host-catalog/host-profile'
import {
  useFoldableRailThumbBottom,
  type FoldablePostureMetrics
} from '../../layout/foldable-posture'
import { newWorkspaceOverlayHref } from '../../new-workspace/new-workspace-overlay-route'
import { triggerMediumImpact } from '../../platform/haptics/haptics'
import type { RpcClient } from '../../transport/rpc/rpc-client-contract'
import type { Worktree } from '../../worktree/workspace-list/workspace-list-types'
import type { HomeBotRow } from '../bots/home-bot-rows'
import type { MobileHomeData } from '../use-mobile-home-data'
import type { FourZoneHomeTabId, HomeTabId } from '../tabs/home-tabs'
import { MobileHomeBotsTab } from '../tabs/MobileHomeBotsTab'
import { MobileHomeProjectsTab } from '../tabs/MobileHomeProjectsTab'
import { MobileHomeTeamsTab } from '../tabs/MobileHomeTeamsTab'
import { MobileHomeUsageTab } from '../tabs/MobileHomeUsageTab'
import type { MobileProjectsPlatform } from '../tabs/mobile-four-zone'
import {
  foldableStageHref,
  type FoldableStageTarget
} from './foldable-stage-types'
import { mobileFoldableStyles as styles } from './mobile-foldable-styles'
import { MobileFoldableRail } from './MobileFoldableRail'
import { MobileFoldableStage } from './MobileFoldableStage'
import { MobileFoldableTabletopView } from './MobileFoldableTabletopView'

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
  canCreateBot: boolean
  stageTarget: FoldableStageTarget | null
  onChangeStageTarget: (next: FoldableStageTarget | null) => void
  clientOf: (pairedHostId: string) => RpcClient | null
  onSelectTab: (tab: FourZoneHomeTabId) => void
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
  const { thumbBottom, toggleThumbBottom } = useFoldableRailThumbBottom()
  const [midCollapsed, setMidCollapsed] = useState(false)
  const [splitActive, setSplitActive] = useState(false)
  const [tabletopDismissed, setTabletopDismissed] = useState(false)

  // Reset manual tabletop override whenever the device leaves half-opened posture.
  useEffect(() => {
    if (!foldable.isTabletop && tabletopDismissed) {
      setTabletopDismissed(false)
    }
  }, [foldable.isTabletop, tabletopDismissed])

  // Auto-seed the right stage with the top active single-chat agent so unfolded Magic V6 is never empty.
  useEffect(() => {
    if (stageTarget != null) {
      return
    }
    const firstActive = data.activeAgents[0] ?? data.agentsNeedingYou[0]
    if (firstActive) {
      onChangeStageTarget({
        kind: 'session',
        hostId: firstActive.hostId,
        worktreeId: firstActive.entry.worktreeId,
        name: firstActive.entry.workspaceName || firstActive.title,
        paneKey: firstActive.entry.agent.paneKey,
        executionHost: firstActive.entry.executionHost?.id
      })
    }
  }, [data.activeAgents, data.agentsNeedingYou, onChangeStageTarget, stageTarget])

  const handleOpenWorktreeInStage = useCallback(
    (host: HostCatalogEntry, row: Worktree) => {
      if (host.credentialStatus === 'missing' || host.credentialStatus === 'temporarily-unavailable') {
        props.onOpenHost(host)
        return
      }
      onChangeStageTarget({
        kind: 'session',
        hostId: host.id,
        worktreeId: row.worktreeId,
        name: row.displayName?.trim() || row.repo
      })
    },
    [onChangeStageTarget, props]
  )

  const handleOpenAgentInStage = useCallback(
    (row: AgentListRow) => {
      onChangeStageTarget({
        kind: 'session',
        hostId: row.hostId,
        worktreeId: row.entry.worktreeId,
        name: row.entry.workspaceName || row.title,
        paneKey: row.entry.agent.paneKey,
        executionHost: row.entry.executionHost?.id
      })
    },
    [onChangeStageTarget]
  )

  const handleOpenBotInStage = useCallback(
    (row: HomeBotRow) => {
      if (row.offline) {
        return
      }
      if (row.kind === 'group') {
        setSplitActive(false)
        onChangeStageTarget({
          kind: 'group',
          hostId: row.pairedHostId,
          groupId: row.group.id,
          name: row.group.name
        })
        return
      }
      const client = props.clientOf(row.pairedHostId)
      const place = { pairedHostId: row.pairedHostId, executionHost: row.executionHost }
      const target: FoldableStageTarget = {
        kind: 'session',
        hostId: row.pairedHostId,
        worktreeId: botHomeWorktreeId(row.bot),
        name: row.bot.name,
        ...(row.executionHost !== LOCAL_EXECUTION_HOST_ID
          ? { executionHost: row.executionHost }
          : {})
      }
      if (client) {
        void ensureBotHomeChat(botPlaceClient(client, place), row.bot.id).then(() =>
          onChangeStageTarget(target)
        )
      } else {
        onChangeStageTarget(target)
      }
    },
    [onChangeStageTarget, props]
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
  const showMidPane = !isUsageTab && !midCollapsed && !splitActive

  const handleToggleSplit = () => {
    triggerMediumImpact()
    setSplitActive((prev) => {
      const next = !prev
      if (next) {
        setMidCollapsed(true)
      } else {
        setMidCollapsed(false)
      }
      return next
    })
  }

  const handleToggleMid = () => {
    if (splitActive) {
      setSplitActive(false)
      setMidCollapsed(false)
      return
    }
    setMidCollapsed((prev) => !prev)
  }

  return (
    <View style={styles.workbenchRoot}>
      <MobileFoldableRail
        tabs={props.fourZoneTabOrder}
        active={props.activeTab}
        thumbBottom={thumbBottom}
        midCollapsed={midCollapsed || splitActive}
        teamsBadge={props.teamsBadge}
        botsBadge={props.soloBotsBadge}
        projectsBadge={props.projectsBadge}
        onSelect={(next) => {
          props.onSelectTab(next)
          if (next !== 'usage' && splitActive) {
            setSplitActive(false)
            setMidCollapsed(false)
          }
        }}
        onLongPressTab={props.onLongPressTab}
        onToggleThumbBottom={toggleThumbBottom}
        onToggleMidCollapsed={handleToggleMid}
        onToggleClassicLayout={props.onToggleClassicLayout}
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
      ) : (
        <>
          {showMidPane ? (
            <View style={[styles.midPane, { width: foldable.midPaneWidth }]}>
              {props.activeTab === 'teams' ? (
                <MobileHomeTeamsTab
                  data={data}
                  bottomInset={16}
                  onOpenBot={handleOpenBotInStage}
                  onPairDesktop={props.onPairDesktop}
                  onOpenSettings={props.onOpenSettings}
                  onToggleClassicLayout={props.onToggleClassicLayout}
                />
              ) : props.activeTab === 'bots' ? (
                <MobileHomeBotsTab
                  data={data}
                  bottomInset={16}
                  onNewBot={props.canCreateBot ? props.onOpenNewBot : undefined}
                  onOpenBot={handleOpenBotInStage}
                  rowKind="bot"
                  titleOverride="单独 Bot"
                />
              ) : (
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
              )}
            </View>
          ) : null}

          <MobileFoldableStage
            target={stageTarget}
            midCollapsed={midCollapsed}
            splitActive={splitActive}
            hingeGap={foldable.hingeGap}
            onToggleMidCollapsed={handleToggleMid}
            onToggleSplit={handleToggleSplit}
            onOpenFullScreen={handleOpenFullScreen}
          />
        </>
      )}
    </View>
  )
}
