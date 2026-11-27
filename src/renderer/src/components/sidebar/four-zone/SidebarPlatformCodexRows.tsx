import React, { useEffect, useRef, useState } from 'react'
import { Folder, FolderInput, FolderOpen, GitBranch, Pencil, RotateCcw, SquarePen } from 'lucide-react'
import { cn } from '@/lib/class-names'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import {
  formatCodexRelativeTime,
  type CodexActivityTone,
  type CodexProjectRow,
  type CodexRecentRow
} from './sidebar-codex-types'

const INITIAL_PROJECT_THREADS = 5
const DRAG_MIME = 'application/x-orca-codex-thread'

function isLiveCodexThread(item: CodexRecentRow): boolean {
  return (
    item.statusTone === 'working' ||
    item.statusTone === 'attention' ||
    item.isUnread ||
    item.isActive
  )
}

export function CodexStatusDot({ tone }: { tone: CodexActivityTone }): React.JSX.Element | null {
  if (tone === 'idle') {
    return null
  }
  return (
    <span
      aria-hidden
      className={cn(
        'size-1.5 shrink-0 rounded-full',
        tone === 'working' && 'bg-amber-500 animate-pulse',
        tone === 'attention' && 'bg-amber-500',
        tone === 'active' && 'bg-emerald-500'
      )}
    />
  )
}

export function CodexProjectRowItem({
  project,
  allProjects,
  movedThreadKeys,
  isExpanded,
  onlyActive,
  onToggleExpand,
  onActivateWorktree,
  onSelectThread,
  onCreateWorkspace,
  onRenameProject,
  onMoveThread,
  onResetThreadMove
}: {
  project: CodexProjectRow
  allProjects: readonly CodexProjectRow[]
  movedThreadKeys: Readonly<Record<string, string>>
  isExpanded: boolean
  onlyActive: boolean
  onToggleExpand: (projectKey: string) => void
  onActivateWorktree: (worktreeId: string, hostId: ExecutionHostId) => void
  onSelectThread: (item: CodexRecentRow) => void
  onCreateWorkspace: (project: CodexProjectRow) => void
  onRenameProject: (project: CodexProjectRow, nextName: string) => void | Promise<void>
  onMoveThread: (threadKey: string, targetProjectKey: string) => void
  onResetThreadMove: (threadKey: string) => void
}): React.JSX.Element {
  const [showAllThreads, setShowAllThreads] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(project.name)
  const [dropActive, setDropActive] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [renaming])

  const beginRename = () => {
    setDraftName(project.name)
    setRenaming(true)
  }

  const commitRename = () => {
    setRenaming(false)
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== project.name) {
      void onRenameProject(project, trimmed)
    }
  }

  const cancelRename = () => {
    setRenaming(false)
    setDraftName(project.name)
  }

  const filteredThreads = onlyActive
    ? project.threads.filter(isLiveCodexThread)
    : project.threads
  const threadWorktreeIds = new Set(filteredThreads.map((t) => t.worktreeId))
  const extraWorktrees =
    project.worktrees.length > 1
      ? project.worktrees.filter(
          (wt) =>
            !threadWorktreeIds.has(wt.id) &&
            (!onlyActive || wt.statusTone !== 'idle' || wt.isActive)
        )
      : []

  const hasChildren = filteredThreads.length > 0 || extraWorktrees.length > 0
  const childrenVisible = hasChildren && isExpanded
  const visibleThreads = showAllThreads
    ? filteredThreads
    : filteredThreads.slice(0, INITIAL_PROJECT_THREADS)
  const hiddenThreadCount = filteredThreads.length - visibleThreads.length

  const hasActiveChild =
    childrenVisible &&
    (visibleThreads.some((t) => t.isActive) || extraWorktrees.some((wt) => wt.isActive))
  const highlightProjectRow = project.isActive && !hasActiveChild
  const moveTargets = allProjects.filter((candidate) => candidate.key !== project.key)

  return (
    <div
      className="flex flex-col"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(DRAG_MIME)) {
          return
        }
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        if (!dropActive) {
          setDropActive(true)
        }
      }}
      onDragLeave={() => {
        if (dropActive) {
          setDropActive(false)
        }
      }}
      onDrop={(event) => {
        const threadKey = event.dataTransfer.getData(DRAG_MIME)
        setDropActive(false)
        if (threadKey) {
          event.preventDefault()
          onMoveThread(threadKey, project.key)
        }
      }}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              'group flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] transition-colors',
              dropActive
                ? 'bg-primary/12 text-foreground ring-1 ring-primary/60'
                : highlightProjectRow
                  ? 'bg-worktree-sidebar-foreground/10 font-medium text-foreground'
                  : hasActiveChild
                    ? 'font-medium text-foreground/90 hover:bg-worktree-sidebar-foreground/6'
                    : 'text-foreground/78 hover:bg-worktree-sidebar-foreground/6 hover:text-foreground'
            )}
          >
            {renaming ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Folder className="size-3.5 shrink-0 text-muted-foreground/75" aria-hidden />
                <input
                  ref={inputRef}
                  type="text"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      commitRename()
                    } else if (event.key === 'Escape') {
                      event.preventDefault()
                      cancelRename()
                    }
                  }}
                  aria-label="修改项目名称"
                  className="h-5 min-w-0 flex-1 rounded bg-background px-1.5 text-[13px] font-normal text-foreground ring-1 ring-ring outline-none"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (hasChildren) {
                    onToggleExpand(project.key)
                  } else {
                    onActivateWorktree(project.primaryWorktree.id, project.primaryWorktree.hostId)
                  }
                }}
                className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none"
              >
                {childrenVisible ? (
                  <FolderOpen className="size-3.5 shrink-0 text-muted-foreground/75" aria-hidden />
                ) : (
                  <Folder className="size-3.5 shrink-0 text-muted-foreground/75" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
              </button>
            )}

            {!renaming ? (
              <div className="flex shrink-0 items-center gap-1.5">
                {!childrenVisible && project.statusTone !== 'idle' ? (
                  <CodexStatusDot tone={project.statusTone} />
                ) : null}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`在 ${project.name} 中新建对话`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onCreateWorkspace(project)
                      }}
                      className="flex size-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-worktree-sidebar-foreground/10 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <SquarePen className="size-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={6}>
                    在 {project.name} 新建对话
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : null}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-40">
          <ContextMenuItem onSelect={() => setTimeout(beginRename, 0)}>
            <Pencil className="mr-2 size-3.5" />
            重命名项目
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onCreateWorkspace(project)}>
            <SquarePen className="mr-2 size-3.5" />
            新建对话 / 工作区
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() =>
              onActivateWorktree(project.primaryWorktree.id, project.primaryWorktree.hostId)
            }
          >
            <FolderOpen className="mr-2 size-3.5" />
            打开工作区
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {childrenVisible ? (
        <div className="mt-0.5 mb-1 flex flex-col gap-0.5 pl-4">
          {visibleThreads.map((thread) => {
            const relTime = formatCodexRelativeTime(thread.timestamp)
            const isMoved = thread.key in movedThreadKeys
            return (
              <ContextMenu key={thread.key}>
                <ContextMenuTrigger asChild>
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(DRAG_MIME, thread.key)
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                    onClick={() => onSelectThread(thread)}
                    title={thread.title}
                    className={cn(
                      'flex h-7 items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors',
                      thread.isActive
                        ? 'bg-worktree-sidebar-foreground/10 font-medium text-foreground'
                        : 'text-foreground/82 hover:bg-worktree-sidebar-foreground/6 hover:text-foreground'
                    )}
                  >
                    <span className="flex w-2 shrink-0 items-center justify-center">
                      <CodexStatusDot tone={thread.statusTone} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                    {relTime ? (
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/60">
                        {relTime}
                      </span>
                    ) : null}
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-44">
                  <ContextMenuSub>
                    <ContextMenuSubTrigger disabled={moveTargets.length === 0}>
                      <FolderInput className="mr-2 size-3.5" />
                      移动到项目
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="max-h-64 w-48 overflow-y-auto">
                      {moveTargets.map((target) => (
                        <ContextMenuItem
                          key={target.key}
                          onSelect={() => onMoveThread(thread.key, target.key)}
                        >
                          <Folder className="mr-2 size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{target.name}</span>
                        </ContextMenuItem>
                      ))}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                  {isMoved ? (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuItem onSelect={() => onResetThreadMove(thread.key)}>
                        <RotateCcw className="mr-2 size-3.5" />
                        移回原项目
                      </ContextMenuItem>
                    </>
                  ) : null}
                </ContextMenuContent>
              </ContextMenu>
            )
          })}

          {extraWorktrees.map((wt) => {
            const relTime = formatCodexRelativeTime(wt.lastActivityAt)
            return (
              <button
                key={wt.id}
                type="button"
                onClick={() => onActivateWorktree(wt.id, wt.hostId)}
                className={cn(
                  'flex h-7 items-center gap-2 rounded-md px-2 text-left text-[12.5px] transition-colors',
                  wt.isActive
                    ? 'bg-worktree-sidebar-foreground/10 font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-worktree-sidebar-foreground/6 hover:text-foreground'
                )}
              >
                <GitBranch className="size-3 shrink-0 opacity-55" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{wt.label}</span>
                {wt.statusTone !== 'idle' ? <CodexStatusDot tone={wt.statusTone} /> : null}
                {relTime ? (
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/60">
                    {relTime}
                  </span>
                ) : null}
              </button>
            )
          })}

          {hiddenThreadCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAllThreads(true)}
              className="mt-0.5 rounded-md px-2 py-1 pl-6 text-left text-[11px] text-muted-foreground/80 transition-colors hover:bg-worktree-sidebar-foreground/6 hover:text-foreground"
            >
              展开其余 {hiddenThreadCount} 条…
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function CodexRecentRowItem({
  item,
  hostTag,
  onSelect
}: {
  item: CodexRecentRow
  hostTag?: string
  onSelect: (item: CodexRecentRow) => void
}): React.JSX.Element {
  const relTime = formatCodexRelativeTime(item.timestamp)
  const metaHint = hostTag ? `${hostTag} · ${item.projectName}` : item.projectName
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      title={`${metaHint} · ${item.title}`}
      className={cn(
        'flex h-7 items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors',
        item.isActive
          ? 'bg-worktree-sidebar-foreground/10 font-medium text-foreground'
          : 'text-foreground/82 hover:bg-worktree-sidebar-foreground/6 hover:text-foreground'
      )}
    >
      <span className="flex w-2 shrink-0 items-center justify-center">
        <CodexStatusDot tone={item.statusTone} />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      {item.title !== item.projectName ? (
        <span className="max-w-[72px] shrink-0 truncate text-[10.5px] text-muted-foreground/60">
          {item.projectName}
        </span>
      ) : null}
      {relTime ? (
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/60">{relTime}</span>
      ) : null}
    </button>
  )
}
