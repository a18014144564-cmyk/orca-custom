import React from 'react'
import { ChevronDown, ChevronRight, GitBranch, Plus } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { RepoMark } from '@/components/repo/RepoMark'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import {
  formatCodexRelativeTime,
  type CodexActivityTone,
  type CodexProjectRow,
  type CodexRecentRow
} from './sidebar-codex-types'

export function CodexStatusCornerDot({ tone }: { tone: CodexActivityTone }): React.JSX.Element | null {
  if (tone === 'idle') {
    return null
  }
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-[1.5px] ring-worktree-sidebar',
        tone === 'working' && 'bg-amber-500 animate-pulse',
        tone === 'attention' && 'bg-amber-500',
        tone === 'active' && 'bg-emerald-500'
      )}
    />
  )
}

export function CodexProjectRowItem({
  project,
  anyExpandable,
  isExpanded,
  onToggleExpand,
  onActivateWorktree,
  onCreateWorkspace
}: {
  project: CodexProjectRow
  anyExpandable: boolean
  isExpanded: boolean
  onToggleExpand: (projectKey: string) => void
  onActivateWorktree: (worktreeId: string, hostId: ExecutionHostId) => void
  onCreateWorkspace: (project: CodexProjectRow) => void
}): React.JSX.Element {
  const isMulti = project.worktrees.length > 1
  return (
    <div className="flex flex-col">
      <div
        className={cn(
          'group flex h-8 items-center gap-1.5 rounded-md px-1.5 text-[13px] transition-colors',
          project.isActive
            ? 'bg-worktree-sidebar-foreground/10 font-medium text-foreground'
            : 'text-foreground/85 hover:bg-worktree-sidebar-foreground/6 hover:text-foreground'
        )}
      >
        {anyExpandable ? (
          isMulti ? (
            <button
              type="button"
              aria-label={isExpanded ? '收起分支' : '展开分支'}
              aria-expanded={isExpanded}
              onClick={(event) => {
                event.stopPropagation()
                onToggleExpand(project.key)
              }}
              className="flex size-3.5 shrink-0 items-center justify-center rounded text-muted-foreground/80 hover:bg-worktree-sidebar-foreground/10 hover:text-foreground"
            >
              {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </button>
          ) : (
            <span aria-hidden className="size-3.5 shrink-0" />
          )
        ) : null}

        <button
          type="button"
          onClick={() =>
            onActivateWorktree(project.primaryWorktree.id, project.primaryWorktree.hostId)
          }
          className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none"
        >
          <span className="relative inline-flex shrink-0">
            <RepoMark repo={project.markRepo} size="sm" className="size-5 rounded-[5px]" />
            <CodexStatusCornerDot tone={project.statusTone} />
          </span>
          <span className="min-w-0 flex-1 truncate">{project.name}</span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {project.openTabCount > 0 ? (
            <span className="rounded bg-worktree-sidebar-foreground/6 px-1.5 py-0.5 text-[10px] leading-none font-medium tabular-nums text-muted-foreground">
              {project.openTabCount}
            </span>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`在 ${project.name} 中新建工作区`}
                onClick={(event) => {
                  event.stopPropagation()
                  onCreateWorkspace(project)
                }}
                className="flex size-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-worktree-sidebar-foreground/10 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Plus className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={6}>
              新建工作区 / 对话
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {isMulti && isExpanded ? (
        <div className="mt-0.5 mb-1 ml-5 flex flex-col gap-0.5 border-l border-worktree-sidebar-border/80 pl-2">
          {project.worktrees.map((wt) => (
            <button
              key={wt.id}
              type="button"
              onClick={() => onActivateWorktree(wt.id, wt.hostId)}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-1.5 text-left text-xs transition-colors',
                wt.isActive
                  ? 'bg-worktree-sidebar-foreground/10 font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-worktree-sidebar-foreground/6 hover:text-foreground'
              )}
            >
              <GitBranch className="size-3 shrink-0 opacity-70" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{wt.label}</span>
              {wt.statusTone !== 'idle' ? (
                <span
                  aria-hidden
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    wt.statusTone === 'working' && 'bg-amber-500 animate-pulse',
                    wt.statusTone === 'attention' && 'bg-amber-500',
                    wt.statusTone === 'active' && 'bg-emerald-500'
                  )}
                />
              ) : null}
              {wt.openTabCount > 0 ? (
                <span className="text-[10px] tabular-nums opacity-70">{wt.openTabCount}</span>
              ) : null}
            </button>
          ))}
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
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      title={hostTag ? `[${hostTag}] ${item.projectName} · ${item.title}` : `${item.projectName} · ${item.title}`}
      className={cn(
        'flex h-7 items-center gap-2 rounded-md px-1.5 text-left text-[13px] transition-colors',
        item.isActive
          ? 'bg-worktree-sidebar-foreground/10 font-medium text-foreground'
          : 'text-foreground/80 hover:bg-worktree-sidebar-foreground/6 hover:text-foreground'
      )}
    >
      <span className="relative inline-flex shrink-0">
        <RepoMark repo={item.markRepo} size="sm" className="size-4 rounded-[4px]" />
        <CodexStatusCornerDot tone={item.statusTone} />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      {hostTag ? (
        <span className="shrink-0 rounded bg-worktree-sidebar-foreground/6 px-1 py-0.5 text-[10px] leading-none text-muted-foreground">
          {hostTag}
        </span>
      ) : null}
      {relTime ? (
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">{relTime}</span>
      ) : null}
    </button>
  )
}
