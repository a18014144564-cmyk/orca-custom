import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Clock, FolderTree, LayoutList, Plus, SlidersHorizontal } from 'lucide-react'
import { useAppStore } from '@/store'
import { useAppStoreWithHostStatuses } from '@/store/slices/runtime-status/views/use-runtime-status-view'
import { selectFolderWorkspaces, selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { selectSidebarChildrenByParentIdentity } from '@/store/slices/worktrees/metadata/cross-store-lineage-parents'
import { cn } from '@/lib/class-names'
import { useBots, useBotsEnabled } from '@/lib/bot-catalog'
import { useBotGroups } from '@/lib/bot-group-list'
import { activateAndRevealWorkspace } from '@/lib/workspace/activation/worktree-activation'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAllAgentPaneThreads } from '@/components/activity/threads/use-agent-pane-threads'
import { createActivityThreadActions } from '@/components/activity/thread-list/activity-thread-actions'
import { openHeaderCreateComposer } from '../worktree-list/rows/header-create-workspace-target'
import { getBotHomes, getBotListedWorktreeIdentities } from '../../../../../shared/bots/bot-homes'
import type { Worktree } from '../../../../../shared/worktree/types'
import { getSettingsFocusedExecutionHostId, type ExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import { collectExcludedBotSessionIds } from './sidebar-codex-bot-filter'
import { useSidebarHostScopeOptions } from '../worktree-list/controls/use-sidebar-host-scope-options'
import { groupCodexProjectsByHost, resolveCodexZoneHostMeta } from './sidebar-codex-host-groups'
import { buildCodexSidebarModel, type CodexProjectRow, type CodexRecentRow, type CodexTabLike } from './sidebar-codex-model'
import {
  ensureCodexExpanded,
  resolveCodexProjectExpanded,
  setCodexAllProjectsExpanded,
  setCodexViewMode,
  toggleCodexHostCollapsed,
  toggleCodexOnlyActive,
  toggleCodexProjectExpanded,
  useCodexCollapseState
} from './sidebar-codex-collapse-state'
import { dismissCodexArchivedThread, rememberLiveCodexThreads, useCodexArchivedThreads } from './sidebar-codex-thread-archive'
import { reopenArchivedCodexThread } from './sidebar-codex-reopen'
import { moveCodexThreadToProject, resetCodexThreadProject, useCodexThreadProjectMap } from './sidebar-codex-thread-moves'
import { CodexProjectRowItem, CodexRecentRowItem } from './SidebarPlatformCodexRows'

const INITIAL_RECENT_LIMIT = 24
const NO_CHILDREN: ReadonlyMap<string, readonly Worktree[]> = new Map()
const EMPTY_IDENTITIES: ReadonlySet<string> = new Set()
const EMPTY_TABS: Readonly<Record<string, readonly CodexTabLike[] | undefined>> = {}
const EMPTY_BROWSER_TABS: Readonly<Record<string, readonly unknown[] | undefined>> = {}
const HOST_SECTION_STYLE: React.CSSProperties = { contain: 'layout style' }

type SidebarPlatformCodexPaneProps = {
  hostIds: readonly ExecutionHostId[]
  alwaysGroupByHost?: boolean
  emptyStateMessage?: string
  onWorktreeClick?: () => void
  onSwitchClassicList?: () => void
}

function projectMatchesActiveFilter(project: CodexProjectRow): boolean {
  return project.isActive || project.statusTone !== 'idle' || project.threads.some((t) => t.statusTone !== 'idle' || t.isUnread || t.isActive)
}

export const SidebarPlatformCodexPane = React.memo(function SidebarPlatformCodexPane({
  hostIds,
  alwaysGroupByHost = false,
  emptyStateMessage,
  onWorktreeClick,
  onSwitchClassicList
}: SidebarPlatformCodexPaneProps): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const folderWorkspaces = useAppStore(selectFolderWorkspaces)
  const worktreeLineageById = useAppStore((s) => s.worktreeLineageById)
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const pendingRevealWorktree = useAppStore((s) => s.pendingRevealWorktree)
  const clearPendingRevealWorktreeId = useAppStore((s) => s.clearPendingRevealWorktreeId)
  const defaultHostId = useAppStore((s) => getSettingsFocusedExecutionHostId(s.settings))
  const openModal = useAppStore((s) => s.openModal)
  const updateRepo = useAppStore((s) => s.updateRepo)
  const updateFolderWorkspace = useAppStore((s) => s.updateFolderWorkspace)
  const acknowledgeAgents = useAppStore((s) => s.acknowledgeAgents)
  const unacknowledgeAgents = useAppStore((s) => s.unacknowledgeAgents)

  const botsEnabled = useBotsEnabled()
  const bots = useBots(botsEnabled)
  const botGroups = useBotGroups(botsEnabled)
  const { allThreads: liveAllThreads } = useAllAgentPaneThreads()
  // Defer high-frequency streaming thread updates so zone switching and row clicks stay instant.
  const allThreads = useDeferredValue(liveAllThreads)

  const { viewMode, projectExpandOverrides, collapsedHosts, onlyActive } = useCodexCollapseState()
  const [showAllRecent, setShowAllRecent] = useState(false)
  const [selectedPaneKey, setSelectedPaneKey] = useState<string | null>(null)
  const [reopeningThreadKey, setReopeningThreadKey] = useState<string | null>(null)
  const threadProjectOverrides = useCodexThreadProjectMap()
  const archivedThreads = useCodexArchivedThreads()

  const { hostOptions } = useSidebarHostScopeOptions()
  const hostMeta = useMemo(
    () => resolveCodexZoneHostMeta(hostOptions, hostIds),
    [hostOptions, hostIds]
  )

  const botHomeOwners = useMemo(() => [...bots, ...botGroups], [bots, botGroups])
  const childrenByParent = useAppStoreWithHostStatuses((s, statuses) =>
    botHomeOwners.length === 0 ? NO_CHILDREN : selectSidebarChildrenByParentIdentity(s, statuses)
  )
  const botOwnedWorktreeIdentities = useMemo(
    () =>
      botHomeOwners.length === 0
        ? EMPTY_IDENTITIES
        : getBotListedWorktreeIdentities(
            getBotHomes(botHomeOwners, folderWorkspaces).map(({ home }) => home),
            childrenByParent
          ),
    [botHomeOwners, folderWorkspaces, childrenByParent]
  )
  const excludedBotSessionIds = useMemo(
    () => collectExcludedBotSessionIds(bots, botGroups),
    [bots, botGroups]
  )

  const model = useMemo(
    () =>
      buildCodexSidebarModel({
        repos,
        worktreesByRepo,
        folderWorkspaces,
        botHomeOwners,
        botOwnedWorktreeIdentities,
        excludedBotSessionIds,
        worktreeLineageById,
        canonicalHostById: hostMeta.canonicalHostById,
        allThreads,
        tabsByWorktree: EMPTY_TABS,
        browserTabsByWorktree: EMPTY_BROWSER_TABS,
        hostIds,
        defaultHostId,
        activeWorktreeId,
        selectedPaneKey,
        onlyActiveRecent: onlyActive,
        threadProjectOverrides,
        archivedThreads
      }),
    [
      repos, worktreesByRepo, folderWorkspaces, botHomeOwners, botOwnedWorktreeIdentities,
      excludedBotSessionIds, worktreeLineageById, hostMeta.canonicalHostById, allThreads,
      hostIds, defaultHostId, activeWorktreeId,
      selectedPaneKey, onlyActive, threadProjectOverrides, archivedThreads
    ]
  )

  // Archive live threads asynchronously off the hot render path; read unifiedTabs lazily without subscribing in render.
  useEffect(() => {
    const timer = setTimeout(() => {
      rememberLiveCodexThreads(model.recentItems, useAppStore.getState().unifiedTabsByWorktree)
    }, 400)
    return () => clearTimeout(timer)
  }, [model.recentItems])

  // Consume reveal requests (e.g. after creating a new project) so stale pendingRevealWorktree never blocks rail navigation.
  useEffect(() => {
    if (!pendingRevealWorktree) {
      return
    }
    const targetProject = model.projects.find((project) =>
      project.worktrees.some((wt) => wt.id === pendingRevealWorktree.worktreeId)
    )
    if (targetProject) {
      ensureCodexExpanded(targetProject.hostId, targetProject.key)
    }
    clearPendingRevealWorktreeId(pendingRevealWorktree)
  }, [clearPendingRevealWorktreeId, model.projects, pendingRevealWorktree])

  const visibleProjects = useMemo(
    () => (onlyActive ? model.projects.filter(projectMatchesActiveFilter) : model.projects),
    [model.projects, onlyActive]
  )

  const groupByHost = alwaysGroupByHost || hostMeta.multiHost
  const projectHostSections = useMemo(
    () => (groupByHost ? groupCodexProjectsByHost(visibleProjects, hostMeta) : null),
    [groupByHost, hostMeta, visibleProjects]
  )

  const collapsibleProjects = useMemo(
    () => visibleProjects.filter((p) => p.threads.length > 0 || p.worktrees.length > 1),
    [visibleProjects]
  )
  const collapsibleProjectKeys = useMemo(() => collapsibleProjects.map((p) => p.key), [collapsibleProjects])
  const anyCollapsibleExpanded = collapsibleProjects.some((p) =>
    resolveCodexProjectExpanded(p, projectExpandOverrides)
  )

  const threadsRef = useRef(allThreads)
  threadsRef.current = allThreads

  const threadActions = useMemo(
    () =>
      createActivityThreadActions({
        getMarkAllReadThreads: () => threadsRef.current,
        acknowledgeAgents,
        unacknowledgeAgents,
        setSelectedPaneKey
      }),
    [acknowledgeAgents, unacknowledgeAgents]
  )

  const handleActivateWorktree = useCallback(
    (worktreeId: string, hostId: ExecutionHostId) => {
      setSelectedPaneKey(null)
      activateAndRevealWorkspace(worktreeId, { executionHostId: hostId, revealInSidebar: false, clearSidebarFilters: false })
      onWorktreeClick?.()
    },
    [onWorktreeClick]
  )

  const handleProjectCreate = useCallback(
    (project: CodexProjectRow) => {
      if (project.repo) { openHeaderCreateComposer(project.repo, { pinHost: true }) }
      else { openModal('new-workspace-composer', { telemetrySource: 'sidebar' }) }
    },
    [openModal]
  )

  const handleRenameProject = useCallback(
    async (project: CodexProjectRow, nextName: string) => {
      if (project.kind === 'repo' && project.repo) {
        await updateRepo(project.repo.id, { displayName: nextName }, { hostId: project.primaryWorktree.hostId })
      } else if (project.kind === 'folder' && project.folderId) {
        await updateFolderWorkspace(project.folderId, { name: nextName }, { executionHostId: project.primaryWorktree.hostId })
      }
    },
    [updateFolderWorkspace, updateRepo]
  )

  const handleSelectThread = useCallback(
    (item: CodexRecentRow) => {
      if (item.thread) { threadActions.selectThread(item.thread); onWorktreeClick?.(); return }
      setSelectedPaneKey(item.key)
      setReopeningThreadKey(item.key)
      void reopenArchivedCodexThread(item)
        .then((opened) => { if (!opened) { handleActivateWorktree(item.worktreeId, item.hostId) } })
        .finally(() => { setReopeningThreadKey((prev) => (prev === item.key ? null : prev)) })
      onWorktreeClick?.()
    },
    [handleActivateWorktree, onWorktreeClick, threadActions]
  )

  const visibleRecentItems = showAllRecent ? model.recentItems : model.recentItems.slice(0, INITIAL_RECENT_LIMIT)
  const hiddenRecentCount = model.recentItems.length - visibleRecentItems.length
  const renderProjectRow = (project: CodexProjectRow) => (
    <CodexProjectRowItem
      key={project.key}
      project={project}
      allProjects={model.projects}
      movedThreadKeys={threadProjectOverrides}
      isExpanded={resolveCodexProjectExpanded(project, projectExpandOverrides)}
      onlyActive={onlyActive}
      reopeningThreadKey={reopeningThreadKey}
      onToggleExpand={toggleCodexProjectExpanded}
      onActivateWorktree={handleActivateWorktree}
      onSelectThread={handleSelectThread}
      onCreateWorkspace={handleProjectCreate}
      onRenameProject={handleRenameProject}
      onMoveThread={moveCodexThreadToProject}
      onResetThreadMove={resetCodexThreadProject}
      onDismissArchivedThread={dismissCodexArchivedThread}
    />
  )

  if (model.projects.length === 0 && model.totalRecentCount === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 text-center">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {emptyStateMessage ?? '暂无主机工作区'}
        </p>
        <button
          type="button"
          onClick={() => openModal('add-repo', {})}
          className="mt-3 inline-flex items-center gap-1 rounded-md border border-worktree-sidebar-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-worktree-sidebar-foreground/6"
        >
          <Plus className="size-3.5" />
          添加项目
        </button>
      </div>
    )
  }

  return (
    <div
      data-sidebar-codex-pane=""
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3 select-none"
    >
      <div className="mt-0.5 mb-1 flex items-center justify-between px-2 py-1">
        <span className="text-[11px] font-medium text-muted-foreground/85">
          {viewMode === 'tree' ? '线程' : '最近'}
        </span>

        <div className="flex items-center gap-0.5">
          {viewMode === 'tree' && collapsibleProjectKeys.length > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={anyCollapsibleExpanded ? '全部折叠项目' : '全部展开项目'}
                  onClick={() => setCodexAllProjectsExpanded(collapsibleProjectKeys, !anyCollapsibleExpanded)}
                  className="flex size-5 items-center justify-center rounded text-muted-foreground/80 transition-colors hover:bg-worktree-sidebar-foreground/8 hover:text-foreground"
                >
                  {anyCollapsibleExpanded ? <ChevronsDownUp className="size-3" /> : <ChevronsUpDown className="size-3" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {anyCollapsibleExpanded ? '全部折叠项目' : '全部展开项目'}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={viewMode === 'tree' ? '切换为按最近时间排序' : '切换为按项目树形分组'}
                onClick={() => setCodexViewMode(viewMode === 'tree' ? 'recent' : 'tree')}
                className="flex size-5 items-center justify-center rounded text-muted-foreground/80 transition-colors hover:bg-worktree-sidebar-foreground/8 hover:text-foreground"
              >
                {viewMode === 'tree' ? <Clock className="size-3" /> : <FolderTree className="size-3" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {viewMode === 'tree' ? '按最近时间查看' : '按项目分组查看'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={onlyActive ? '显示全部' : '仅显示进行中'}
                aria-pressed={onlyActive}
                onClick={toggleCodexOnlyActive}
                className={cn(
                  'flex size-5 items-center justify-center rounded transition-colors',
                  onlyActive
                    ? 'bg-worktree-sidebar-foreground/12 text-foreground'
                    : 'text-muted-foreground/80 hover:bg-worktree-sidebar-foreground/8 hover:text-foreground'
                )}
              >
                <SlidersHorizontal className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {onlyActive ? '已筛选：仅进行中（点击显示全部）' : '仅显示进行中的对话'}
            </TooltipContent>
          </Tooltip>
          {onSwitchClassicList ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="切换经典卡片列表"
                  onClick={onSwitchClassicList}
                  className="flex size-5 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-worktree-sidebar-foreground/8 hover:text-foreground"
                >
                  <LayoutList className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>切换经典卡片列表</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      {viewMode === 'tree' ? (
        visibleProjects.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground/75">当前没有进行中的项目或对话</p>
        ) : projectHostSections ? (
          <div className="flex flex-col gap-2.5">
            {projectHostSections.map(({ host, projects }) => {
              const hostCollapsed = collapsedHosts.has(host.hostId)
              const dotClass =
                host.health === 'local' || host.health === 'available'
                  ? 'bg-emerald-500'
                  : host.health === 'connecting' || host.health === 'waking' || host.health === 'provisioning'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-muted-foreground/45'
              return (
                <div key={host.hostId} style={HOST_SECTION_STYLE} className="flex flex-col gap-0.5">
                  <button type="button" onClick={() => toggleCodexHostCollapsed(host.hostId)} className="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[12px] font-semibold text-foreground/85 transition-colors hover:bg-worktree-sidebar-foreground/6 hover:text-foreground">
                    {hostCollapsed ? <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/75" /> : <ChevronDown className="size-3.5 shrink-0 text-muted-foreground/75" />}
                    <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
                    <span className="min-w-0 truncate">{host.label}</span>
                    <span className="shrink-0 rounded bg-worktree-sidebar-foreground/6 px-1 py-0.5 text-[10px] leading-none font-medium text-muted-foreground">{host.tag}</span>
                    <span className="ml-auto shrink-0 text-[10.5px] font-normal tabular-nums text-muted-foreground/65">{projects.length}</span>
                  </button>
                  {!hostCollapsed ? <div className="ml-2.5 flex flex-col gap-0.5 border-l border-worktree-sidebar-border/70 pl-2">{projects.map(renderProjectRow)}</div> : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">{visibleProjects.map(renderProjectRow)}</div>
        )
      ) : visibleRecentItems.length === 0 ? (
        <p className="px-2 py-4 text-xs text-muted-foreground/75">{onlyActive ? '当前没有进行中的对话' : '暂无最近对话'}</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {visibleRecentItems.map((item) => {
            const hostInfo = hostMeta.multiHost ? hostMeta.hostInfoById.get(item.hostId) : undefined
            const hostTag = hostInfo ? (hostInfo.isLocal ? '本地' : hostInfo.label) : undefined
            return <CodexRecentRowItem key={item.key} item={item} hostTag={hostTag} onSelect={handleSelectThread} />
          })}
          {hiddenRecentCount > 0 ? (
            <button type="button" onClick={() => setShowAllRecent(true)} className="mt-0.5 rounded-md px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-worktree-sidebar-foreground/6 hover:text-foreground">
              展开其余 {hiddenRecentCount} 条…
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
})
