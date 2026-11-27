import React, { useCallback, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Clock, FolderTree, Plus, SlidersHorizontal } from 'lucide-react'
import { useAppStore } from '@/store'
import { useAppStoreWithHostStatuses } from '@/store/slices/runtime-status/views/use-runtime-status-view'
import {
  selectFolderWorkspaces,
  selectWorktreesByRepo
} from '@/store/workspaces/catalog/workspace-record-fields'
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
import {
  getSettingsFocusedExecutionHostId,
  type ExecutionHostId
} from '../../../../../shared/execution-host/execution-host'
import { collectExcludedBotSessionIds } from './sidebar-codex-bot-filter'
import { useSidebarHostScopeOptions } from '../worktree-list/controls/use-sidebar-host-scope-options'
import { groupCodexProjectsByHost, resolveCodexZoneHostMeta } from './sidebar-codex-host-groups'
import { buildCodexSidebarModel, type CodexProjectRow, type CodexRecentRow } from './sidebar-codex-model'
import { CodexProjectRowItem, CodexRecentRowItem } from './SidebarPlatformCodexRows'

const INITIAL_RECENT_LIMIT = 24
const NO_CHILDREN: ReadonlyMap<string, readonly Worktree[]> = new Map()
const EMPTY_IDENTITIES: ReadonlySet<string> = new Set()

type ViewMode = 'tree' | 'recent'

type SidebarPlatformCodexPaneProps = {
  hostIds: readonly ExecutionHostId[]
  emptyStateMessage?: string
  onWorktreeClick?: () => void
}

function projectMatchesActiveFilter(project: CodexProjectRow): boolean {
  return (
    project.isActive ||
    project.statusTone !== 'idle' ||
    project.threads.some((t) => t.statusTone !== 'idle' || t.isUnread || t.isActive)
  )
}

export const SidebarPlatformCodexPane = React.memo(function SidebarPlatformCodexPane({
  hostIds,
  emptyStateMessage,
  onWorktreeClick
}: SidebarPlatformCodexPaneProps): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const folderWorkspaces = useAppStore(selectFolderWorkspaces)
  const worktreeLineageById = useAppStore((s) => s.worktreeLineageById)
  const tabsByWorktree = useAppStore((s) => s.tabsByWorktree)
  const browserTabsByWorktree = useAppStore((s) => s.browserTabsByWorktree)
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const settings = useAppStore((s) => s.settings)
  const openModal = useAppStore((s) => s.openModal)
  const updateRepo = useAppStore((s) => s.updateRepo)
  const updateFolderWorkspace = useAppStore((s) => s.updateFolderWorkspace)
  const acknowledgeAgents = useAppStore((s) => s.acknowledgeAgents)
  const unacknowledgeAgents = useAppStore((s) => s.unacknowledgeAgents)

  const botsEnabled = useBotsEnabled()
  const bots = useBots(botsEnabled)
  const botGroups = useBotGroups(botsEnabled)
  const { allThreads } = useAllAgentPaneThreads()

  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [collapsedProjects, setCollapsedProjects] = useState<ReadonlySet<string>>(() => new Set())
  const [collapsedHosts, setCollapsedHosts] = useState<ReadonlySet<string>>(() => new Set())
  const [onlyActive, setOnlyActive] = useState(false)
  const [showAllRecent, setShowAllRecent] = useState(false)
  const [selectedPaneKey, setSelectedPaneKey] = useState<string | null>(null)

  const { hostOptions } = useSidebarHostScopeOptions()
  const hostMeta = useMemo(
    () => resolveCodexZoneHostMeta(hostOptions, hostIds),
    [hostOptions, hostIds]
  )

  const defaultHostId = getSettingsFocusedExecutionHostId(settings)
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
        tabsByWorktree,
        browserTabsByWorktree,
        hostIds,
        defaultHostId,
        activeWorktreeId,
        selectedPaneKey,
        onlyActiveRecent: onlyActive
      }),
    [
      repos,
      worktreesByRepo,
      folderWorkspaces,
      botHomeOwners,
      botOwnedWorktreeIdentities,
      excludedBotSessionIds,
      worktreeLineageById,
      hostMeta.canonicalHostById,
      allThreads,
      tabsByWorktree,
      browserTabsByWorktree,
      hostIds,
      defaultHostId,
      activeWorktreeId,
      selectedPaneKey,
      onlyActive
    ]
  )

  const visibleProjects = useMemo(
    () => (onlyActive ? model.projects.filter(projectMatchesActiveFilter) : model.projects),
    [model.projects, onlyActive]
  )

  const projectHostSections = useMemo(
    () => (hostMeta.multiHost ? groupCodexProjectsByHost(visibleProjects, hostMeta) : null),
    [hostMeta, visibleProjects]
  )

  const toggleHostCollapsed = useCallback((hostId: string) => {
    setCollapsedHosts((prev) => {
      const next = new Set(prev)
      if (next.has(hostId)) { next.delete(hostId) } else { next.add(hostId) }
      return next
    })
  }, [])

  const toggleProjectCollapsed = useCallback((projectKey: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectKey)) { next.delete(projectKey) } else { next.add(projectKey) }
      return next
    })
  }, [])

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
      activateAndRevealWorkspace(worktreeId, {
        executionHostId: hostId,
        revealInSidebar: false,
        clearSidebarFilters: false
      })
      onWorktreeClick?.()
    },
    [onWorktreeClick]
  )

  const handleProjectCreate = useCallback(
    (project: CodexProjectRow) => {
      if (project.repo) {
        openHeaderCreateComposer(project.repo, { pinHost: true })
      } else {
        openModal('new-workspace-composer', { telemetrySource: 'sidebar' })
      }
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
      if (item.thread) {
        threadActions.selectThread(item.thread)
        onWorktreeClick?.()
        return
      }
      handleActivateWorktree(item.worktreeId, item.hostId)
    },
    [handleActivateWorktree, onWorktreeClick, threadActions]
  )

  const visibleRecentItems = showAllRecent
    ? model.recentItems
    : model.recentItems.slice(0, INITIAL_RECENT_LIMIT)
  const hiddenRecentCount = model.recentItems.length - visibleRecentItems.length

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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={viewMode === 'tree' ? '切换为按最近时间排序' : '切换为按项目树形分组'}
                onClick={() => setViewMode((prev) => (prev === 'tree' ? 'recent' : 'tree'))}
                className="flex size-5 items-center justify-center rounded text-muted-foreground/80 transition-colors hover:bg-worktree-sidebar-foreground/8 hover:text-foreground"
              >
                {viewMode === 'tree' ? (
                  <Clock className="size-3" />
                ) : (
                  <FolderTree className="size-3" />
                )}
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
                onClick={() => setOnlyActive((prev) => !prev)}
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
                  : host.health === 'connecting' ||
                      host.health === 'waking' ||
                      host.health === 'provisioning'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-muted-foreground/45'
              return (
                <div key={host.hostId} className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleHostCollapsed(host.hostId)}
                    className="flex h-6 items-center gap-1.5 rounded px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-worktree-sidebar-foreground/6 hover:text-foreground"
                  >
                    {hostCollapsed ? (
                      <ChevronRight className="size-3 shrink-0 opacity-70" />
                    ) : (
                      <ChevronDown className="size-3 shrink-0 opacity-70" />
                    )}
                    <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
                    <span className="min-w-0 truncate">{host.label}</span>
                    <span className="shrink-0 rounded bg-worktree-sidebar-foreground/6 px-1 py-0.5 text-[10px] leading-none text-muted-foreground/85">
                      {host.tag}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] tabular-nums opacity-60">
                      {projects.length}
                    </span>
                  </button>
                  {!hostCollapsed ? (
                    <div className="flex flex-col gap-0.5">
                      {projects.map((project) => (
                        <CodexProjectRowItem
                          key={project.key}
                          project={project}
                          isExpanded={!collapsedProjects.has(project.key)}
                          onlyActive={onlyActive}
                          onToggleExpand={toggleProjectCollapsed}
                          onActivateWorktree={handleActivateWorktree}
                          onSelectThread={handleSelectThread}
                          onCreateWorkspace={handleProjectCreate}
                          onRenameProject={handleRenameProject}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {visibleProjects.map((project) => (
              <CodexProjectRowItem
                key={project.key}
                project={project}
                isExpanded={!collapsedProjects.has(project.key)}
                onlyActive={onlyActive}
                onToggleExpand={toggleProjectCollapsed}
                onActivateWorktree={handleActivateWorktree}
                onSelectThread={handleSelectThread}
                onCreateWorkspace={handleProjectCreate}
                onRenameProject={handleRenameProject}
              />
            ))}
          </div>
        )
      ) : visibleRecentItems.length === 0 ? (
        <p className="px-2 py-4 text-xs text-muted-foreground/75">
          {onlyActive ? '当前没有进行中的对话' : '暂无最近对话'}
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {visibleRecentItems.map((item) => {
            const hostInfo = hostMeta.multiHost ? hostMeta.hostInfoById.get(item.hostId) : undefined
            const hostTag = hostInfo ? (hostInfo.isLocal ? '本地' : hostInfo.label) : undefined
            return (
              <CodexRecentRowItem
                key={item.key}
                item={item}
                hostTag={hostTag}
                onSelect={handleSelectThread}
              />
            )
          })}
          {hiddenRecentCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAllRecent(true)}
              className="mt-0.5 rounded-md px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-worktree-sidebar-foreground/6 hover:text-foreground"
            >
              展开其余 {hiddenRecentCount} 条…
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
})
