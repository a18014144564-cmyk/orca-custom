import React, { useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { useSidebarHostScopeOptions } from '@/components/sidebar/worktree-list/controls/use-sidebar-host-scope-options'
import {
  resolveCodexZoneHostMeta,
  type CodexHostGroupInfo
} from '@/components/sidebar/four-zone/sidebar-codex-host-groups'
import {
  toggleCodexBotHostCollapsed,
  useCodexCollapseState
} from '@/components/sidebar/four-zone/sidebar-codex-collapse-state'
import type { ExecutionHostId } from '../../../../shared/execution-host/execution-host'

type HostKeyedEntry = {
  id: string
  kind: 'bot' | 'group'
  bot?: { hostId: ExecutionHostId }
  group?: { hostId: ExecutionHostId }
}

function entryHostId(entry: HostKeyedEntry): ExecutionHostId {
  return entry.kind === 'bot' ? entry.bot!.hostId : entry.group!.hostId
}

/** Groups Bot / Team sidebar entries under collapsible computer headers with crisp indentation when multiple hosts exist. */
export function BotSidebarHostGroups<Entry extends HostKeyedEntry>({
  entries,
  renderEntry
}: {
  entries: readonly Entry[]
  renderEntry: (entry: Entry, index: number) => React.ReactNode
}): React.JSX.Element | null {
  const { hostOptions } = useSidebarHostScopeOptions()
  const { collapsedBotHosts: collapsedHosts } = useCodexCollapseState()

  const sections = useMemo(() => {
    const rawHostIds: ExecutionHostId[] = []
    for (const entry of entries) {
      rawHostIds.push(entryHostId(entry))
    }
    const meta = resolveCodexZoneHostMeta(hostOptions, rawHostIds)
    const buckets = new Map<ExecutionHostId, { entry: Entry; index: number }[]>()
    entries.forEach((entry, index) => {
      const raw = entryHostId(entry)
      const canonical = meta.canonicalHostById.get(raw) ?? raw
      const list = buckets.get(canonical)
      if (list) {
        list.push({ entry, index })
      } else {
        buckets.set(canonical, [{ entry, index }])
      }
    })
    if (buckets.size <= 1) {
      return null
    }
    const ordered: { host: CodexHostGroupInfo; items: { entry: Entry; index: number }[] }[] = []
    for (const host of meta.hosts) {
      const items = buckets.get(host.hostId)
      if (items && items.length > 0) {
        ordered.push({ host, items })
        buckets.delete(host.hostId)
      }
    }
    for (const [hostId, items] of buckets) {
      const info = meta.hostInfoById.get(hostId)
      if (info && items.length > 0) {
        ordered.push({ host: info, items })
      }
    }
    return ordered
  }, [entries, hostOptions])

  if (!sections) {
    return null
  }

  return (
    <div className="flex flex-col gap-2 px-1 pb-1">
      {sections.map(({ host, items }) => {
        const collapsed = collapsedHosts.has(host.hostId)
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
              onClick={() => toggleCodexBotHostCollapsed(host.hostId)}
              className="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[12px] font-semibold text-foreground/85 transition-colors hover:bg-worktree-sidebar-foreground/6 hover:text-foreground"
            >
              {collapsed ? (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/75" />
              ) : (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground/75" />
              )}
              <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
              <span className="min-w-0 truncate">{host.label}</span>
              <span className="shrink-0 rounded bg-worktree-sidebar-foreground/6 px-1 py-0.5 text-[10px] leading-none font-medium text-muted-foreground">
                {host.tag}
              </span>
              <span className="ml-auto shrink-0 text-[10.5px] font-normal tabular-nums text-muted-foreground/65">
                {items.length}
              </span>
            </button>
            {!collapsed ? (
              <div className="ml-2.5 flex flex-col gap-0.5 border-l border-worktree-sidebar-border/70 pl-1.5">
                {items.map(({ entry, index }) => (
                  <React.Fragment key={entry.id}>{renderEntry(entry, index)}</React.Fragment>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
