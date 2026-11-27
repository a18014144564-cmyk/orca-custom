import type { Repo } from '../../../../../shared/repository/repo-types'
import type { FolderWorkspace } from '../../../../../shared/folder-workspaces/folder-workspace-types'
import { DEFAULT_REPO_BADGE_COLOR } from '../../../../../shared/repository/appearance/repo-badge-color'
import { folderWorkspaceKey } from '../../../../../shared/workspace/identity/workspace-scope'
import type { ExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import type { RepoMarkRepo } from '@/components/repo/RepoMark'
import type {
  ActivityLiveAgentState,
  AgentPaneThread
} from '@/components/activity/threads/activity-thread-types'

export type CodexActivityTone = 'working' | 'attention' | 'active' | 'idle'

export type CodexProjectWorktreeItem = {
  id: string
  hostId: ExecutionHostId
  label: string
  branch: string
  isMain: boolean
  isActive: boolean
  isPinned: boolean
  openTabCount: number
  statusTone: CodexActivityTone
  lastActivityAt: number
}

export type CodexProjectRow = {
  key: string
  kind: 'repo' | 'folder'
  name: string
  repo: Repo | null
  markRepo: RepoMarkRepo
  primaryWorktree: CodexProjectWorktreeItem
  worktrees: CodexProjectWorktreeItem[]
  openTabCount: number
  isActive: boolean
  isPinned: boolean
  statusTone: CodexActivityTone
  lastActivityAt: number
  addedAt: number
}

export type CodexRecentRow = {
  key: string
  kind: 'thread' | 'worktree'
  title: string
  projectName: string
  worktreeId: string
  hostId: ExecutionHostId
  markRepo: RepoMarkRepo
  statusTone: CodexActivityTone
  isActive: boolean
  isUnread: boolean
  timestamp: number
  thread: AgentPaneThread | null
}

export type CodexSidebarModel = {
  projects: CodexProjectRow[]
  recentItems: CodexRecentRow[]
  totalRecentCount: number
}

export const CODEX_TONE_PRIORITY: Record<CodexActivityTone, number> = {
  working: 3,
  attention: 2,
  active: 1,
  idle: 0
}

export function higherCodexTone(
  left: CodexActivityTone,
  right: CodexActivityTone
): CodexActivityTone {
  return CODEX_TONE_PRIORITY[left] >= CODEX_TONE_PRIORITY[right] ? left : right
}

export function mapAgentStateToCodexTone(
  state: ActivityLiveAgentState | null | undefined,
  unread: boolean
): CodexActivityTone {
  if (state === 'working') {
    return 'working'
  }
  if (state === 'blocked' || state === 'waiting') {
    return 'attention'
  }
  if (state === 'monitoring' || state === 'unverifiable' || unread) {
    return 'active'
  }
  return 'idle'
}

export function buildFolderRepoMark(folder: FolderWorkspace): RepoMarkRepo {
  return {
    id: folderWorkspaceKey(folder.id),
    displayName: folder.name,
    badgeColor: DEFAULT_REPO_BADGE_COLOR,
    repoIcon: null,
    addedAt: folder.createdAt,
    executionHostId: folder.executionHostId ?? null,
    connectionId: folder.connectionId ?? null
  }
}

export function formatCodexRelativeTime(timestamp: number, now: number = Date.now()): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return ''
  }
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (diffSec < 60) {
    return '刚刚'
  }
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) {
    return `${diffMin}m`
  }
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) {
    return `${diffHour}h`
  }
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) {
    return `${diffDay}d`
  }
  return `${Math.floor(diffDay / 30)}mo`
}

export type CodexTabLike = { id?: string }

export function makeCodexFallbackRecentRow(args: {
  title: string
  projectName: string
  worktreeId: string
  hostId: ExecutionHostId
  markRepo: RepoMarkRepo
  statusTone: CodexActivityTone
  isActive: boolean
  isUnread: boolean
  timestamp: number
}): CodexRecentRow {
  return {
    key: `worktree:${args.worktreeId}`,
    kind: 'worktree',
    title: args.title,
    projectName: args.projectName,
    worktreeId: args.worktreeId,
    hostId: args.hostId,
    markRepo: args.markRepo,
    statusTone: args.isActive && args.statusTone === 'idle' ? 'active' : args.statusTone,
    isActive: args.isActive,
    isUnread: args.isUnread,
    timestamp: args.timestamp,
    thread: null
  }
}
