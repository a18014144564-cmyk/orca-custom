import { useSyncExternalStore } from 'react'
import { DEFAULT_REPO_BADGE_COLOR } from '../../../../../shared/repository/appearance/repo-badge-color'
import type { ExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import {
  isStructuredAgentSessionHostTabId,
  structuredAgentSessionHostTabId
} from '../../../../../shared/agent-session/view/structured-agent-session-host-tab-id'
import { structuredAgentSessionPaneKey } from '../../../../../shared/agent-session/view/structured-agent-session-projection'
import { structuredAgentSessionIdOfTab } from '../../../../../shared/agent-session/view/structured-agent-session-tab'
import type { CodexProjectRow, CodexRecentRow } from './sidebar-codex-types'

const STORAGE_KEY = 'orca.custom.codexArchivedThreads.v1'
const MAX_ARCHIVED_THREADS = 150
const HOST_TAB_PREFIX = structuredAgentSessionHostTabId('')
const listeners = new Set<() => void>()

export type ArchivedCodexUnifiedTabLike = Readonly<{
  id: string
  contentType?: string
  entityId?: string | null
  agentSessionAgent?: string | null
}>

export type ArchivedCodexThread = Readonly<{
  key: string
  title: string
  projectName: string
  worktreeId: string
  hostId: ExecutionHostId
  sessionId: string | null
  providerSessionId?: string | null
  agentType: string | null
  timestamp: number
}>

export function extractStructuredSessionIdFromTabId(tabId: string | null | undefined): string | null {
  if (!tabId) {
    return null
  }
  const legacy = structuredAgentSessionIdOfTab(tabId)
  if (legacy) {
    return legacy
  }
  if (isStructuredAgentSessionHostTabId(tabId) && tabId.length > HOST_TAB_PREFIX.length) {
    return tabId.slice(HOST_TAB_PREFIX.length)
  }
  return null
}

/** Extracts a structured sessionId from a paneKey (`structured-agent-session-<id>:<leaf>` or `agent-session:<id>:<leaf>`) or row key (`thread:...`). */
export function extractStructuredSessionIdFromKey(keyOrPaneKey: string | null | undefined): string | null {
  if (!keyOrPaneKey) {
    return null
  }
  const paneKey = keyOrPaneKey.startsWith('thread:') ? keyOrPaneKey.slice('thread:'.length) : keyOrPaneKey
  const lastColon = paneKey.lastIndexOf(':')
  const tabPart = lastColon > 0 ? paneKey.slice(0, lastColon) : paneKey
  return extractStructuredSessionIdFromTabId(tabPart)
}

function resolveLiveRowSessionId(
  row: CodexRecentRow,
  unifiedTabsByWorktree?: Readonly<Record<string, readonly ArchivedCodexUnifiedTabLike[] | undefined>>
): { sessionId: string | null; agentType: string | null } {
  const thread = row.thread
  if (!thread) {
    return {
      sessionId: row.archivedSessionId ?? extractStructuredSessionIdFromKey(row.key),
      agentType: row.archivedAgentType ?? null
    }
  }
  const tabs = unifiedTabsByWorktree?.[row.worktreeId] ?? []
  const matchedUnifiedTab = tabs.find(
    (tab) =>
      tab.contentType === 'agent-session' &&
      Boolean(tab.entityId) &&
      (tab.id === thread.tab.id ||
        extractStructuredSessionIdFromTabId(thread.tab.id) === tab.entityId ||
        structuredAgentSessionPaneKey(tab.id, tab.entityId!) === thread.paneKey)
  )
  const tabWithEntity = thread.tab as { id?: string; entityId?: string }
  const sessionId =
    matchedUnifiedTab?.entityId ??
    extractStructuredSessionIdFromKey(thread.paneKey) ??
    extractStructuredSessionIdFromTabId(thread.tab.id) ??
    tabWithEntity.entityId ??
    thread.paneEntry?.orcaSessionId ??
    thread.currentAgentEntry?.orcaSessionId ??
    null
  const agentType = matchedUnifiedTab?.agentSessionAgent ?? thread.agentType ?? null
  return { sessionId, agentType }
}

let archivedList: readonly ArchivedCodexThread[] = readStoredArchive()

function readStoredArchive(): readonly ArchivedCodexThread[] {
  if (typeof window === 'undefined') {
    return []
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    const clean: ArchivedCodexThread[] = []
    for (const item of parsed) {
      if (
        typeof item === 'object' &&
        item !== null &&
        typeof item.key === 'string' &&
        typeof item.title === 'string' &&
        typeof item.worktreeId === 'string' &&
        typeof item.hostId === 'string' &&
        typeof item.timestamp === 'number'
      ) {
        clean.push({
          key: item.key,
          title: item.title,
          projectName: typeof item.projectName === 'string' ? item.projectName : '',
          worktreeId: item.worktreeId,
          hostId: item.hostId as ExecutionHostId,
          sessionId:
            typeof item.sessionId === 'string' && item.sessionId.length > 0
              ? item.sessionId
              : extractStructuredSessionIdFromKey(item.key),
          providerSessionId:
            typeof item.providerSessionId === 'string' && item.providerSessionId.length > 0
              ? item.providerSessionId
              : null,
          agentType: typeof item.agentType === 'string' ? item.agentType : null,
          timestamp: item.timestamp
        })
      }
    }
    return clean.slice(0, MAX_ARCHIVED_THREADS)
  } catch {
    return []
  }
}

let pendingWriteTimer: ReturnType<typeof setTimeout> | null = null

function flushArchiveToStorage(): void {
  pendingWriteTimer = null
  if (typeof window === 'undefined') { return }
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(archivedList)) } catch { /* ignore quota */ }
}

function commitArchive(next: readonly ArchivedCodexThread[], immediate = false): void {
  archivedList = next
  if (typeof window !== 'undefined') {
    if (immediate) {
      if (pendingWriteTimer !== null) { clearTimeout(pendingWriteTimer) }
      flushArchiveToStorage()
    } else if (pendingWriteTimer === null) {
      pendingWriteTimer = setTimeout(flushArchiveToStorage, 1500)
    }
  }
  for (const listener of listeners) { listener() }
}

export function rememberLiveCodexThreads(
  rows: readonly CodexRecentRow[],
  unifiedTabsByWorktree?: Readonly<Record<string, readonly ArchivedCodexUnifiedTabLike[] | undefined>>
): void {
  const byKey = new Map<string, ArchivedCodexThread>(archivedList.map((item) => [item.key, item]))
  let changed = false
  for (const row of rows) {
    if (row.kind !== 'thread' || !row.thread) {
      continue
    }
    const resolved = resolveLiveRowSessionId(row, unifiedTabsByWorktree)
    const existing = byKey.get(row.key)
    const nextSessionId = resolved.sessionId ?? existing?.sessionId ?? null
    const nextAgentType = resolved.agentType ?? existing?.agentType ?? null
    if (
      existing &&
      existing.title === row.title &&
      existing.worktreeId === row.worktreeId &&
      existing.sessionId === nextSessionId &&
      Math.abs(existing.timestamp - row.timestamp) < 60_000
    ) {
      continue
    }
    byKey.set(row.key, {
      key: row.key,
      title: row.title,
      projectName: row.projectName,
      worktreeId: row.worktreeId,
      hostId: row.hostId,
      sessionId: nextSessionId,
      agentType: nextAgentType,
      timestamp: row.timestamp
    })
    changed = true
  }
  if (!changed) {
    return
  }
  const sorted = [...byKey.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_ARCHIVED_THREADS)
  commitArchive(sorted)
}

export function dismissCodexArchivedThread(threadKey: string): void {
  const next = archivedList.filter((item) => item.key !== threadKey)
  if (next.length !== archivedList.length) {
    commitArchive(next, true)
  }
}

export function useCodexArchivedThreads(): readonly ArchivedCodexThread[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => archivedList,
    () => archivedList
  )
}

/** Merges previously seen threads (whose top tab was closed) back into their project tree so closing a tab never deletes sidebar history. */
export function mergeArchivedCodexThreads(args: {
  projects: readonly CodexProjectRow[]
  liveRows: CodexRecentRow[]
  archivedThreads: readonly ArchivedCodexThread[] | undefined
  hostIdSet: ReadonlySet<ExecutionHostId>
  botHomeWorktreeIds: ReadonlySet<string>
  activeWorktreeId: string | null
  selectedPaneKey: string | null
}): void {
  const { archivedThreads } = args
  if (!archivedThreads || archivedThreads.length === 0) { return }
  const liveKeys = new Set<string>(args.liveRows.map((row) => row.key))
  const liveSessionIds = new Set<string>()
  for (const row of args.liveRows) {
    if (!row.thread) { continue }
    const sid =
      extractStructuredSessionIdFromKey(row.thread.paneKey) ??
      extractStructuredSessionIdFromTabId(row.thread.tab.id) ??
      row.thread.paneEntry?.orcaSessionId ??
      row.thread.currentAgentEntry?.orcaSessionId ??
      (row.thread.tab as { entityId?: string }).entityId
    if (sid) { liveSessionIds.add(sid) }
  }
  const projectByWorktreeId = new Map<string, CodexProjectRow>()
  for (const project of args.projects) {
    for (const wt of project.worktrees) { projectByWorktreeId.set(wt.id, project) }
  }
  for (const archived of archivedThreads) {
    const resolvedSessionId = archived.sessionId ?? extractStructuredSessionIdFromKey(archived.key)
    if (
      !args.hostIdSet.has(archived.hostId) ||
      args.botHomeWorktreeIds.has(archived.worktreeId) ||
      liveKeys.has(archived.key) ||
      (resolvedSessionId && liveSessionIds.has(resolvedSessionId))
    ) { continue }
    const owner = projectByWorktreeId.get(archived.worktreeId)
    if (!owner) { continue }
    liveKeys.add(archived.key)
    const row: CodexRecentRow = {
      key: archived.key,
      kind: 'thread',
      title: archived.title,
      projectName: owner.name || archived.projectName,
      worktreeId: archived.worktreeId,
      hostId: archived.hostId,
      markRepo: owner.markRepo ?? {
        id: archived.worktreeId, displayName: archived.projectName,
        badgeColor: DEFAULT_REPO_BADGE_COLOR, repoIcon: null, addedAt: 0,
        executionHostId: archived.hostId, connectionId: null
      },
      statusTone: 'idle',
      isActive: args.selectedPaneKey === archived.key,
      isUnread: false,
      timestamp: archived.timestamp,
      thread: null,
      isArchived: true,
      archivedSessionId: resolvedSessionId,
      archivedAgentType: archived.agentType
    }
    owner.threads.push(row)
    args.liveRows.push(row)
  }
}
