import { useCallback, useDeferredValue, useMemo, useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import { useAppStoreWithHostStatuses } from '@/store/slices/runtime-status/views/use-runtime-status-view'
import { isRunningActivityState } from '../events/activity-event-state'
import {
  useAgentPaneThreadsDefaultHostId,
  type AgentPaneThreadsStoreData
} from './use-agent-pane-thread-store-data'
import {
  getActivityThreadInputs,
  readActivityThreadSnapshot,
  subscribeActivityThreads,
  type ActivityThreadSnapshot
} from './activity-thread-projection'
import { collectHiddenChildAgentPaneKeys } from './activity-thread-child-agent'
import {
  EMPTY_PAIRED_DEVICE_IDS_BY_ENVIRONMENT,
  getPairedDeviceIdsByEnvironment
} from '../../../../../shared/workspace-view/workspace-creator-visibility'
import {
  filterThreadsByActivityScope,
  resolveActivityScopeRepoIds
} from '../thread-list/activity-scope-filter'
import {
  createActivityThreadSearchMatcher,
  buildActivityThreadGroups,
  isActivitySearchQueryTooLarge
} from '../thread-list/activity-thread-grouping'
import type {
  ActivityGroupBy,
  ThreadReadFilter
} from '../../../../../shared/agent-status/presentation/agents-view-thread-filters'
import type { ActivityThreadGroup, AgentPaneThread } from './activity-thread-types'
import { useBotsEnabled } from '@/lib/bot-catalog'
import { useBotGroups } from '@/lib/bot-group-list'
import { selectFolderWorkspaces } from '@/store/workspaces/catalog/workspace-record-fields'
import { selectSidebarChildrenByParentIdentity } from '@/store/slices/worktrees/metadata/cross-store-lineage-parents'
import {
  getBotHomes,
  getBotListedWorktreeIdentities,
  isHome
} from '../../../../../shared/bots/bot-homes'
import { folderWorkspaceKey } from '../../../../../shared/workspace/identity/workspace-scope'
import { getWorktreeExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import type { Worktree } from '../../../../../shared/worktree/types'
import {
  collectExcludedBotTeamSessionIds,
  isExcludedBotOrTeamThread
} from '@/components/sidebar/four-zone/sidebar-codex-bot-filter'

const EMPTY_PANE_KEYS: ReadonlySet<string> = new Set()
const EMPTY_THREADS: AgentPaneThread[] = []
const EMPTY_GROUPS: ActivityThreadGroup[] = []
const NO_CHILDREN: ReadonlyMap<string, readonly Worktree[]> = new Map()

/** Every Activity thread before any view filter, read from the window's shared projection. */
export function useAllAgentPaneThreads({
  badgeOnly = false
}: { badgeOnly?: boolean } = {}): ActivityThreadSnapshot {
  const mode = badgeOnly ? 'live' : 'all'
  const subscribe = useCallback(
    (listener: () => void) => subscribeActivityThreads(mode, listener),
    [mode]
  )
  const getInputs = useCallback(() => getActivityThreadInputs(mode), [mode])
  const inputs = useSyncExternalStore(subscribe, getInputs)
  return readActivityThreadSnapshot(mode, inputs)
}

/** Shared Activity/sidebar pipeline: store data to events, threads, filters and groups. */
export function useAgentPaneThreads(args: {
  query: string
  readFilter: ThreadReadFilter
  groupBy: ActivityGroupBy
  selectedPaneKey: string | null
  showChildAgents?: boolean
  /** Prepare only live badge rows, omitting list groups and bulk-action sets. */
  badgeOnly?: boolean
}): {
  storeData: AgentPaneThreadsStoreData
  allThreads: AgentPaneThread[]
  selectedPaneKeyIsLive: boolean
  effectiveSelectedPaneKey: string | null
  /** Every active view filter applies here; destructive Clear completed must not touch hidden rows. */
  visibleThreads: AgentPaneThread[]
  /** Badge-coherent threads after child classification; ignore transient search/scope/read filters so Mark all read can clear the badge. */
  markAllReadThreads: AgentPaneThread[]
  visibleThreadGroups: ActivityThreadGroup[]
} {
  const {
    query,
    readFilter,
    groupBy,
    selectedPaneKey,
    showChildAgents = false,
    badgeOnly = false
  } = args
  const agentsVisibleHostIds = useAppStore((s) => s.agentsVisibleHostIds)
  const agentsFilterRepoIds = useAppStore((s) => s.agentsFilterRepoIds)
  const hideWorkspacesFromOtherDevices = useAppStore((s) => s.agentsHideWorkspacesFromOtherDevices)
  const hideAutomationGeneratedWorkspaces = useAppStore(
    (s) => s.agentsHideAutomationGeneratedWorkspaces
  )
  const hideCliCreatedWorkspaces = useAppStore((s) => s.agentsHideCliCreatedWorkspaces)
  // Why gated selectors: runtime status churns, and only the other-device filter reads it.
  const runtimeEnvironments = useAppStore((s) =>
    s.agentsHideWorkspacesFromOtherDevices ? s.runtimeEnvironments : null
  )
  const pairedHostStatuses = useAppStoreWithHostStatuses((s, statuses) =>
    s.agentsHideWorkspacesFromOtherDevices ? statuses : null
  )
  const pairedDeviceIdsByEnvironment = useMemo(
    () =>
      runtimeEnvironments && pairedHostStatuses
        ? getPairedDeviceIdsByEnvironment(runtimeEnvironments, pairedHostStatuses)
        : EMPTY_PAIRED_DEVICE_IDS_BY_ENVIRONMENT,
    [runtimeEnvironments, pairedHostStatuses]
  )
  const { storeData: unscopedStoreData, allThreads: rawAllThreads } = useAllAgentPaneThreads({
    badgeOnly
  })
  const defaultHostId = useAgentPaneThreadsDefaultHostId()
  const storeData = useMemo(
    () => ({ ...unscopedStoreData, defaultHostId }),
    [unscopedStoreData, defaultHostId]
  )
  const botsEnabled = useBotsEnabled()
  const botGroups = useBotGroups(botsEnabled)
  const folderWorkspaces = useAppStore(selectFolderWorkspaces)
  const worktreeLineageById = useAppStore((s) => s.worktreeLineageById)
  const teamChildrenByParent = useAppStoreWithHostStatuses((s, statuses) =>
    botGroups.length === 0 ? NO_CHILDREN : selectSidebarChildrenByParentIdentity(s, statuses)
  )
  // Keep Bot Team chats and dispatched orchestration workers strictly inside the Bot Teams zone;
  // global Activity / bell only shows direct single-chat threads.
  const allThreads = useMemo(() => {
    const excludedTeamSessionIds = collectExcludedBotTeamSessionIds(botGroups)
    const teamHomeWorktreeIds = new Set<string>()
    if (botGroups.length > 0) {
      for (const folder of folderWorkspaces) {
        if (isHome(folder, botGroups)) {
          teamHomeWorktreeIds.add(folderWorkspaceKey(folder.id))
        }
      }
    }
    const teamOwnedWorktreeIdentities =
      botGroups.length === 0
        ? EMPTY_PANE_KEYS
        : getBotListedWorktreeIdentities(
            getBotHomes(botGroups, folderWorkspaces).map(({ home }) => home),
            teamChildrenByParent
          )
    return rawAllThreads.filter((thread) => {
      const hostId = getWorktreeExecutionHostId(
        thread.worktree,
        thread.repo ?? undefined,
        defaultHostId
      )
      return !isExcludedBotOrTeamThread(thread, hostId, {
        botHomeWorktreeIds: teamHomeWorktreeIds,
        botOwnedWorktreeIdentities: teamOwnedWorktreeIdentities,
        excludedBotSessionIds: excludedTeamSessionIds,
        worktreeLineageById
      })
    })
  }, [
    rawAllThreads,
    botGroups,
    folderWorkspaces,
    teamChildrenByParent,
    worktreeLineageById,
    defaultHostId
  ])

  const selectedPaneKeyIsLive =
    selectedPaneKey === null || allThreads.some((thread) => thread.paneKey === selectedPaneKey)
  const effectiveSelectedPaneKey = selectedPaneKeyIsLive ? selectedPaneKey : null

  // Why scope runs before the per-view filters: host/project/origin scope must stay separate
  // from unread/search narrowing.
  const { threads: scopeVisibleThreads } = useMemo(
    () =>
      filterThreadsByActivityScope({
        threads: allThreads,
        scope: {
          visibleHostIds: agentsVisibleHostIds,
          filterRepoIds: resolveActivityScopeRepoIds(agentsFilterRepoIds, storeData.repoMap),
          defaultHostId: storeData.defaultHostId,
          hideWorkspacesFromOtherDevices,
          pairedDeviceIdsByEnvironment,
          hideAutomationGeneratedWorkspaces,
          hideCliCreatedWorkspaces
        },
        exemptPaneKey: effectiveSelectedPaneKey
      }),
    [
      allThreads,
      agentsVisibleHostIds,
      agentsFilterRepoIds,
      storeData.repoMap,
      storeData.defaultHostId,
      hideWorkspacesFromOtherDevices,
      pairedDeviceIdsByEnvironment,
      hideAutomationGeneratedWorkspaces,
      hideCliCreatedWorkspaces,
      effectiveSelectedPaneKey
    ]
  )

  // Classify children over all threads so scoped-out parents do not orphan workers; skip when children are shown.
  const hiddenChildAgentPaneKeys = useMemo(
    () =>
      badgeOnly || showChildAgents ? EMPTY_PANE_KEYS : collectHiddenChildAgentPaneKeys(allThreads),
    [allThreads, showChildAgents, badgeOnly]
  )

  // Defer list filtering while typed input updates at full priority.
  const deferredQuery = useDeferredValue(query)
  const visibleThreads = useMemo(() => {
    const normalizedQuery = isActivitySearchQueryTooLarge(deferredQuery)
      ? null
      : deferredQuery.trim().toLowerCase()
    const matchesSearchQuery =
      normalizedQuery === null ? null : createActivityThreadSearchMatcher(normalizedQuery)
    return scopeVisibleThreads.filter((thread) => {
      // Keep live agents and the selected row visible after marking read; migration blocks are unavailable.
      if (
        readFilter === 'unread' &&
        !thread.unread &&
        (!isRunningActivityState(thread.currentAgentState) ||
          thread.migrationUnsupportedPtyId !== undefined) &&
        thread.paneKey !== effectiveSelectedPaneKey
      ) {
        return false
      }
      // Why: child agents (e.g. dispatched orchestration workers) are hidden by default to keep top-level agent views focused on root tasks; a live child always keeps its own row.
      if (
        !showChildAgents &&
        hiddenChildAgentPaneKeys.has(thread.paneKey) &&
        thread.paneKey !== effectiveSelectedPaneKey
      ) {
        return false
      }
      return matchesSearchQuery !== null && matchesSearchQuery(thread)
    })
  }, [
    scopeVisibleThreads,
    readFilter,
    deferredQuery,
    effectiveSelectedPaneKey,
    showChildAgents,
    hiddenChildAgentPaneKeys
  ])

  const markAllReadThreads = useMemo(
    () =>
      badgeOnly
        ? EMPTY_THREADS
        : allThreads.filter(
            (thread) =>
              showChildAgents ||
              !hiddenChildAgentPaneKeys.has(thread.paneKey) ||
              thread.paneKey === effectiveSelectedPaneKey
          ),
    [allThreads, showChildAgents, hiddenChildAgentPaneKeys, effectiveSelectedPaneKey, badgeOnly]
  )

  const visibleThreadGroups = useMemo(
    () => (badgeOnly ? EMPTY_GROUPS : buildActivityThreadGroups(visibleThreads, groupBy)),
    [visibleThreads, groupBy, badgeOnly]
  )

  return {
    storeData,
    allThreads,
    selectedPaneKeyIsLive,
    effectiveSelectedPaneKey,
    visibleThreads,
    markAllReadThreads,
    visibleThreadGroups
  }
}
