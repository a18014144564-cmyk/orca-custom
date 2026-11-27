import React, { useMemo, useState } from 'react'
import { Folder, FolderInput, Loader2, RotateCcw, Trash2 } from 'lucide-react'
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
import {
  formatCodexRelativeTime,
  type CodexActivityTone,
  type CodexProjectRow,
  type CodexRecentRow
} from './sidebar-codex-types'

export const CODEX_THREAD_DRAG_MIME = 'application/x-orca-codex-thread'

export const CodexStatusDot = React.memo(function CodexStatusDot({
  tone
}: {
  tone: CodexActivityTone
}): React.JSX.Element | null {
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
})

/** Memoized thread row with lazy-mounted ContextMenu content so idle rows carry near-zero Radix overhead. */
export const CodexThreadRowItem = React.memo(function CodexThreadRowItem({
  thread,
  projectKey,
  allProjects,
  isMoved,
  isReopening,
  onSelectThread,
  onMoveThread,
  onResetThreadMove,
  onDismissArchivedThread
}: {
  thread: CodexRecentRow
  projectKey: string
  allProjects: readonly CodexProjectRow[]
  isMoved: boolean
  isReopening: boolean
  onSelectThread: (item: CodexRecentRow) => void
  onMoveThread: (threadKey: string, targetProjectKey: string) => void
  onResetThreadMove: (threadKey: string) => void
  onDismissArchivedThread: (threadKey: string) => void
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const relTime = formatCodexRelativeTime(thread.timestamp)
  const moveTargets = useMemo(
    () => (menuOpen ? allProjects.filter((candidate) => candidate.key !== projectKey) : []),
    [allProjects, menuOpen, projectKey]
  )

  return (
    <ContextMenu onOpenChange={setMenuOpen}>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(CODEX_THREAD_DRAG_MIME, thread.key)
            event.dataTransfer.effectAllowed = 'move'
          }}
          onClick={() => onSelectThread(thread)}
          title={thread.title}
          className={cn(
            'flex h-7 items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors duration-100',
            thread.isActive
              ? 'bg-worktree-sidebar-foreground/10 font-medium text-foreground'
              : 'text-foreground/82 hover:bg-worktree-sidebar-foreground/6 hover:text-foreground',
            isReopening && 'opacity-75'
          )}
        >
          <span className="flex w-2.5 shrink-0 items-center justify-center">
            {isReopening ? (
              <Loader2 className="size-2.5 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <CodexStatusDot tone={thread.statusTone} />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate">{thread.title}</span>
          {relTime ? (
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/60">
              {relTime}
            </span>
          ) : null}
        </button>
      </ContextMenuTrigger>
      {menuOpen ? (
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
          {thread.isArchived ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onSelect={() => onDismissArchivedThread(thread.key)}
              >
                <Trash2 className="mr-2 size-3.5" />
                从左侧列表移除
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      ) : null}
    </ContextMenu>
  )
})
