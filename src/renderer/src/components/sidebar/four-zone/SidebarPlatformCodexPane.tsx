import React, { useCallback, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, SlidersHorizontal, SquarePen } from 'lucide-react'
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
import { buildCodexSidebarModel, type CodexProjectRow, type CodexRecentRow } from './sidebar-codex-model'
import { CodexProjectRowItem, CodexRecentRowItem } from './SidebarPlatformCodexRows'

const INITIAL_RECENT_LIMIT = 18
const NO_CHILDREN: ReadonlyMap<string, readonly Worktree[]> = new Map()
const EMPTY_IDENTITIES: ReadonlySet<string> = new Set()

type SidebarPlatformCodexPaneProps = {
  hostIds: readonly ExecutionHostId[]
  emptyStateMessage?: string
  onWorktreeClick?: () => void
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
  const acknowledgeAgents = useAppStore((s) => s.acknowledgeAgents)
  const unacknowledgeAgents = useAppStore((s) => s.unacknowledgeAgents)

  const botsEnabled = useBotsEnabled()
  const bots = useBots(botsEnabled)
  const botGroups = useBotGroups(botsEnabled)
  const { allThreads } = useAllAgentPaneThreads()

  const [expandedProjects, setExpandedProjects] = useState<ReadonlySet<string>>(() => new Set())
  const [recentCollapsed, setRecentCollapsed] = useState(false)
  const [onlyActiveRecent, setOnlyActiveRecent] = useState(false)
  const [showAllRecent, setShowAllRecent] = useState(false)
  const [selectedPaneKey, setSelectedPaneKey] = useState<string | null>(null)

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
        allThreads,
        tabsByWorktree,
        browserTabsByWorktree,
        hostIds,
        defaultHostId,
        activeWorktreeId,
        selectedPaneKey,
        onlyActiveRecent
      }),
    [
      repos,
      worktreesByRepo,
      folderWorkspaces,
      botHomeOwners,
      botOwnedWorktreeIdentities,
      excludedBotSessionIds,
      worktreeLineageById,
      allThreads,
      tabsByWorktree,
      browserTabsByWorktree,
      hostIds,
      defaultHostId,
      activeWorktreeId,
      selectedPaneKey,
      onlyActiveRecent
    ]
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

  const toggleProjectExpanded = useCallback((projectKey: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectKey)) {
        next.delete(projectKey)
      } else {
        next.add(projectKey)
      }
      return next
    })
  }, [])

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

  const handleSelectRecent = useCallback(
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

  const anyExpandable = useMemo(
    () => model.projects.some((project) => project.worktrees.length > 1),
    [model.projects]
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
      <div className="mt-1 flex items-center justify-between px-1.5 py-1">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground">项目</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="添加项目"
              onClick={() => openModal('add-repo', {})}
              className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-worktree-sidebar-foreground/8 hover:text-foreground"
            >
              <Plus className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={6}>
            添加项目
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col gap-0.5">
        {model.projects.map((project) => (
          <CodexProjectRowItem
            key={project.key}
            project={project}
            anyExpandable={anyExpandable}
            isExpanded={expandedProjects.has(project.key)}
            onToggleExpand={toggleProjectExpanded}
            onActivateWorktree={handleActivateWorktree}
            onCreateWorkspace={handleProjectCreate}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between px-1.5 py-1">
        <button
          type="button"
          onClick={() => setRecentCollapsed((prev) => !prev)}
          className="flex items-center gap-1 text-[11px] font-medium tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          <span>最近</span>
          {recentCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
        </button>

        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={onlyActiveRecent ? '显示全部最近对话' : '仅显示进行中的对话'}
                aria-pressed={onlyActiveRecent}
                onClick={() => setOnlyActiveRecent((prev) => !prev)}
                className={cn(
                  'flex size-5 items-center justify-center rounded transition-colors',
                  onlyActiveRecent
                    ? 'bg-worktree-sidebar-foreground/12 text-foreground'
                    : 'text-muted-foreground hover:bg-worktree-sidebar-foreground/8 hover:text-foreground'
                )}
              >
                <SlidersHorizontal className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {onlyActiveRecent ? '已筛选：仅进行中（点击显示全部）' : '筛选进行中的对话'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="新建对话"
                onClick={() => openModal('new-workspace-composer', { telemetrySource: 'sidebar' })}
                className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-worktree-sidebar-foreground/8 hover:text-foreground"
              >
                <SquarePen className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              新建对话 / 工作区
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {!recentCollapsed ? (
        visibleRecentItems.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground/80">
            {onlyActiveRecent ? '当前没有进行中的对话' : '暂无最近对话'}
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {visibleRecentItems.map((item) => (
              <CodexRecentRowItem key={item.key} item={item} onSelect={handleSelectRecent} />
            ))}
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
        )
      ) : null}
    </div>
  )
})
