import React, { useState } from 'react'
import { Folder, FolderOpen, GitBranch, SquarePen } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import {
  formatCodexRelativeTime,
  type CodexActivityTone,
  type CodexProjectRow,
  type CodexRecentRow
} from './sidebar-codex-types'

const INITIAL_PROJECT_THREADS = 5

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
  isExpanded,
  onlyActive,
  onToggleExpand,
  onActivateWorktree,
  onSelectThread,
  onCreateWorkspace
}: {
  project: CodexProjectRow
  isExpanded: boolean
  onlyActive: boolean
  onToggleExpand: (projectKey: string) => void
  onActivateWorktree: (worktreeId: string, hostId: ExecutionHostId) => void
  onSelectThread: (item: CodexRecentRow) => void
  onCreateWorkspace: (project: CodexProjectRow) => void
}): React.JSX.Element {
  const [showAllThreads, setShowAllThreads] = useState(false)

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

  // Strictly ONE active gray highlight pill across the entire sidebar.
  const hasActiveChild =
    childrenVisible &&
    (visibleThreads.some((t) => t.isActive) || extraWorktrees.some((wt) => wt.isActive))
  const highlightProjectRow = project.isActive && !hasActiveChild

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          'group flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] transition-colors',
          highlightProjectRow
            ? 'bg-worktree-sidebar-foreground/10 font-medium text-foreground'
            : hasActiveChild
              ? 'font-medium text-foreground/90 hover:bg-worktree-sidebar-foreground/6'
              : 'text-foreground/78 hover:bg-worktree-sidebar-foreground/6 hover:text-foreground'
        )}
      >
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
      </div>

      {childrenVisible ? (
        <div className="mt-0.5 mb-1 flex flex-col gap-0.5 pl-4">
          {visibleThreads.map((thread) => {
            const relTime = formatCodexRelativeTime(thread.timestamp)
            return (
              <button
                key={thread.key}
                type="button"
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
