import { useSyncExternalStore } from 'react'
import { DEFAULT_REPO_BADGE_COLOR } from '../../../../../shared/repository/appearance/repo-badge-color'
import type { ExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import type { CodexProjectRow, CodexRecentRow } from './sidebar-codex-types'

const STORAGE_KEY = 'orca.custom.codexArchivedThreads.v1'
const MAX_ARCHIVED_THREADS = 150
const listeners = new Set<() => void>()

export type ArchivedCodexThread = Readonly<{
  key: string
  title: string
  projectName: string
  worktreeId: string
  hostId: ExecutionHostId
  sessionId: string | null
  agentType: string | null
  timestamp: number
}>

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
          sessionId: typeof item.sessionId === 'string' ? item.sessionId : null,
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

function commitArchive(next: readonly ArchivedCodexThread[]): void {
  archivedList = next
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Ignore storage quota errors.
    }
  }
  for (const listener of listeners) {
    listener()
  }
}

export function rememberLiveCodexThreads(rows: readonly CodexRecentRow[]): void {
  const byKey = new Map<string, ArchivedCodexThread>(archivedList.map((item) => [item.key, item]))
  let changed = false
  for (const row of rows) {
    if (row.kind !== 'thread' || !row.thread) {
      continue
    }
    const tabWithEntity = row.thread.tab as { id?: string; entityId?: string }
    const sessionId =
      row.thread.paneEntry?.orcaSessionId ??
      row.thread.currentAgentEntry?.orcaSessionId ??
      tabWithEntity.entityId ??
      null
    const existing = byKey.get(row.key)
    if (
      existing &&
      existing.title === row.title &&
      existing.worktreeId === row.worktreeId &&
      existing.sessionId === sessionId &&
      Math.abs(existing.timestamp - row.timestamp) < 10_000
    ) {
      continue
    }
    byKey.set(row.key, {
      key: row.key,
      title: row.title,
      projectName: row.projectName,
      worktreeId: row.worktreeId,
      hostId: row.hostId,
      sessionId,
      agentType: row.thread.agentType ?? null,
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
    commitArchive(next)
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
  if (!archivedThreads || archivedThreads.length === 0) {
    return
  }
  const liveKeys = new Set<string>(args.liveRows.map((row) => row.key))
  const liveSessionIds = new Set<string>()
  for (const row of args.liveRows) {
    if (!row.thread) {
      continue
    }
    const sid =
      row.thread.paneEntry?.orcaSessionId ??
      row.thread.currentAgentEntry?.orcaSessionId ??
      (row.thread.tab as { entityId?: string }).entityId
    if (sid) {
      liveSessionIds.add(sid)
    }
  }
  const projectByWorktreeId = new Map<string, CodexProjectRow>()
  for (const project of args.projects) {
    for (const wt of project.worktrees) {
      projectByWorktreeId.set(wt.id, project)
    }
  }
  for (const archived of archivedThreads) {
    if (
      !args.hostIdSet.has(archived.hostId) ||
      args.botHomeWorktreeIds.has(archived.worktreeId) ||
      liveKeys.has(archived.key) ||
      (archived.sessionId && liveSessionIds.has(archived.sessionId))
    ) {
      continue
    }
    const owner = projectByWorktreeId.get(archived.worktreeId)
    if (!owner) {
      continue
    }
    liveKeys.add(archived.key)
    const row: CodexRecentRow = {
      key: archived.key,
      kind: 'thread',
      title: archived.title,
      projectName: owner.name || archived.projectName,
      worktreeId: archived.worktreeId,
      hostId: archived.hostId,
      markRepo: owner.markRepo ?? {
        id: archived.worktreeId,
        displayName: archived.projectName,
        badgeColor: DEFAULT_REPO_BADGE_COLOR,
        repoIcon: null,
        addedAt: 0,
        executionHostId: archived.hostId,
        connectionId: null
      },
      statusTone: 'idle',
      isActive: args.selectedPaneKey === archived.key,
      isUnread: false,
      timestamp: archived.timestamp,
      thread: null,
      isArchived: true,
      archivedSessionId: archived.sessionId,
      archivedAgentType: archived.agentType
    }
    owner.threads.push(row)
    args.liveRows.push(row)
  }
}
