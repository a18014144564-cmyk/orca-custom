import type { Repo } from '../../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import type { WorktreeLineage } from '../../../../../shared/worktree/lineage-types'
import type { FolderWorkspace } from '../../../../../shared/folder-workspaces/folder-workspace-types'
import { DEFAULT_REPO_BADGE_COLOR } from '../../../../../shared/repository/appearance/repo-badge-color'
import { isHome, type BotHomeOwner } from '../../../../../shared/bots/bot-homes'
import { folderWorkspaceKey } from '../../../../../shared/workspace/identity/workspace-scope'
import { getFolderWorkspaceWorktreeHostId } from '../../../../../shared/folder-workspaces/folder-workspace-worktree'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../../shared/workspace/identity/floating-workspace-id'
import {
  getWorktreeExecutionHostId,
  type ExecutionHostId
} from '../../../../../shared/execution-host/execution-host'
import type { RepoMarkRepo } from '@/components/repo/RepoMark'
import type { AgentPaneThread } from '@/components/activity/threads/activity-thread-types'
import {
  isBotOrOrchestrationWorktree,
  isExcludedBotOrTeamThread,
  isExcludedBotSessionTabId
} from './sidebar-codex-bot-filter'
import {
  CODEX_TONE_PRIORITY,
  buildFolderRepoMark,
  higherCodexTone,
  makeCodexFallbackRecentRow,
  mapAgentStateToCodexTone,
  type CodexActivityTone,
  type CodexProjectRow,
  type CodexProjectWorktreeItem,
  type CodexRecentRow,
  type CodexSidebarModel,
  type CodexTabLike
} from './sidebar-codex-types'

export * from './sidebar-codex-types'

const EMPTY_STRING_SET: ReadonlySet<string> = new Set()

function countOpenTabs(
  worktreeId: string,
  tabsByWorktree: Readonly<Record<string, readonly CodexTabLike[] | undefined>>,
  browserTabsByWorktree: Readonly<Record<string, readonly unknown[] | undefined>>,
  excludedBotSessionIds: ReadonlySet<string>
): number {
  const terminalTabs = (tabsByWorktree[worktreeId] ?? []).filter(
    (tab) => !isExcludedBotSessionTabId(tab?.id, excludedBotSessionIds)
  ).length
  return terminalTabs + (browserTabsByWorktree[worktreeId]?.length ?? 0)
}

export function buildCodexSidebarModel(args: {
  repos: readonly Repo[]
  worktreesByRepo: Readonly<Record<string, readonly Worktree[] | undefined>>
  folderWorkspaces: readonly FolderWorkspace[]
  botHomeOwners: readonly BotHomeOwner[]
  botOwnedWorktreeIdentities?: ReadonlySet<string>
  excludedBotSessionIds?: ReadonlySet<string>
  worktreeLineageById?: Readonly<Record<string, WorktreeLineage | undefined>>
  allThreads: readonly AgentPaneThread[]
  tabsByWorktree: Readonly<Record<string, readonly CodexTabLike[] | undefined>>
  browserTabsByWorktree: Readonly<Record<string, readonly unknown[] | undefined>>
  hostIds: readonly ExecutionHostId[]
  defaultHostId: ExecutionHostId
  activeWorktreeId: string | null
  selectedPaneKey: string | null
  onlyActiveRecent: boolean
}): CodexSidebarModel {
  const botOwnedWorktreeIdentities = args.botOwnedWorktreeIdentities ?? EMPTY_STRING_SET
  const excludedBotSessionIds = args.excludedBotSessionIds ?? EMPTY_STRING_SET
  const hostIdSet = new Set<ExecutionHostId>(args.hostIds)
  if (hostIdSet.size === 0) {
    return { projects: [], recentItems: [], totalRecentCount: 0 }
  }

  const botHomeWorktreeIds = new Set<string>()
  const visibleFolders: FolderWorkspace[] = []
  const folderMarkByWorktreeId = new Map<string, RepoMarkRepo>()
  for (const folder of args.folderWorkspaces) {
    if (isHome(folder, args.botHomeOwners)) {
      botHomeWorktreeIds.add(folderWorkspaceKey(folder.id))
      continue
    }
    if (folder.isArchived || folder.orcadRetained || !hostIdSet.has(getFolderWorkspaceWorktreeHostId(folder))) {
      continue
    }
    visibleFolders.push(folder)
    folderMarkByWorktreeId.set(folderWorkspaceKey(folder.id), buildFolderRepoMark(folder))
  }

  const repoById = new Map<string, Repo>(args.repos.map((repo) => [repo.id, repo]))
  const toneByWorktreeId = new Map<string, CodexActivityTone>()
  const latestThreadAtByWorktreeId = new Map<string, number>()
  const worktreeIdsWithThread = new Set<string>()
  const allRecentRows: CodexRecentRow[] = []

  for (const thread of args.allThreads) {
    const wtId = thread.worktree.id
    if (wtId === FLOATING_TERMINAL_WORKTREE_ID) {
      continue
    }
    const repo = thread.repo ?? repoById.get(thread.worktree.repoId) ?? null
    if (repo?.hiddenAt || repo?.orcadRetained) {
      continue
    }
    const hostId = getWorktreeExecutionHostId(thread.worktree, repo ?? undefined, args.defaultHostId)
    if (
      !hostIdSet.has(hostId) ||
      isExcludedBotOrTeamThread(thread, hostId, {
        botHomeWorktreeIds,
        botOwnedWorktreeIdentities,
        excludedBotSessionIds,
        worktreeLineageById: args.worktreeLineageById
      })
    ) {
      continue
    }

    const tone = mapAgentStateToCodexTone(thread.currentAgentState, thread.unread)
    toneByWorktreeId.set(wtId, higherCodexTone(toneByWorktreeId.get(wtId) ?? 'idle', tone))
    const ts = Math.max(thread.latestTimestamp, thread.worktree.lastActivityAt ?? 0)
    latestThreadAtByWorktreeId.set(wtId, Math.max(latestThreadAtByWorktreeId.get(wtId) ?? 0, ts))
    worktreeIdsWithThread.add(wtId)

    const markRepo: RepoMarkRepo =
      repo ??
      folderMarkByWorktreeId.get(wtId) ?? {
        id: wtId,
        displayName: thread.worktree.displayName || 'Workspace',
        badgeColor: DEFAULT_REPO_BADGE_COLOR,
        repoIcon: null,
        addedAt: thread.worktree.createdAt ?? 0,
        executionHostId: hostId,
        connectionId: null
      }
    allRecentRows.push({
      key: `thread:${thread.paneKey}`,
      kind: 'thread',
      title: thread.paneTitle.trim() || thread.worktree.displayName.trim() || markRepo.displayName,
      projectName: markRepo.displayName,
      worktreeId: wtId,
      hostId,
      markRepo,
      statusTone: tone,
      isActive:
        args.selectedPaneKey !== null
          ? args.selectedPaneKey === thread.paneKey
          : args.activeWorktreeId === wtId,
      isUnread: thread.unread,
      timestamp: ts,
      thread
    })
  }

  const projects: CodexProjectRow[] = []

  for (const repo of args.repos) {
    if (repo.hiddenAt || repo.orcadRetained) {
      continue
    }
    const matchingWorktrees = (args.worktreesByRepo[repo.id] ?? []).filter((wt) => {
      if (wt.isArchived) {
        return false
      }
      const hostId = getWorktreeExecutionHostId(wt, repo, args.defaultHostId)
      return (
        hostIdSet.has(hostId) &&
        !isBotOrOrchestrationWorktree(wt, hostId, botOwnedWorktreeIdentities, args.worktreeLineageById)
      )
    })
    if (matchingWorktrees.length === 0) {
      continue
    }

    const worktreeItems: CodexProjectWorktreeItem[] = matchingWorktrees.map((wt) => {
      const hostId = getWorktreeExecutionHostId(wt, repo, args.defaultHostId)
      const openTabCount = countOpenTabs(wt.id, args.tabsByWorktree, args.browserTabsByWorktree, excludedBotSessionIds)
      const threadTone = toneByWorktreeId.get(wt.id) ?? 'idle'
      const branch = (wt.branch || '').replace(/^refs\/heads\//, '')
      return {
        id: wt.id,
        hostId,
        label: wt.displayName.trim() || branch || repo.displayName,
        branch,
        isMain: wt.isMainWorktree,
        isActive: args.activeWorktreeId === wt.id,
        isPinned: wt.isPinned,
        openTabCount,
        statusTone: threadTone !== 'idle' ? threadTone : wt.isUnread ? 'active' : 'idle',
        lastActivityAt: Math.max(wt.lastActivityAt ?? 0, latestThreadAtByWorktreeId.get(wt.id) ?? 0)
      }
    })

    worktreeItems.sort(
      (a, b) =>
        Number(b.isPinned) - Number(a.isPinned) ||
        b.lastActivityAt - a.lastActivityAt ||
        Number(b.isMain) - Number(a.isMain) ||
        a.label.localeCompare(b.label)
    )

    const primaryWorktree = worktreeItems.find((item) => item.isActive) ?? worktreeItems[0]
    projects.push({
      key: `repo:${repo.id}:${primaryWorktree.hostId}`,
      kind: 'repo',
      name: repo.displayName,
      repo,
      markRepo: repo,
      primaryWorktree,
      worktrees: worktreeItems,
      openTabCount: worktreeItems.reduce((sum, item) => sum + item.openTabCount, 0),
      isActive: worktreeItems.some((item) => item.isActive),
      isPinned: worktreeItems.some((item) => item.isPinned),
      statusTone: worktreeItems.reduce<CodexActivityTone>((acc, item) => higherCodexTone(acc, item.statusTone), 'idle'),
      lastActivityAt: worktreeItems.reduce((max, item) => Math.max(max, item.lastActivityAt), 0),
      addedAt: repo.addedAt
    })

    for (const item of worktreeItems) {
      if (worktreeIdsWithThread.has(item.id) || (item.openTabCount === 0 && item.lastActivityAt <= 0 && !item.isActive)) {
        continue
      }
      allRecentRows.push(
        makeCodexFallbackRecentRow({
          title: item.label === repo.displayName && item.branch ? `${repo.displayName} · ${item.branch}` : item.label,
          projectName: repo.displayName,
          worktreeId: item.id,
          hostId: item.hostId,
          markRepo: repo,
          statusTone: item.statusTone,
          isActive: item.isActive,
          isUnread: item.statusTone === 'active',
          timestamp: item.lastActivityAt
        })
      )
    }
  }

  for (const folder of visibleFolders) {
    const wtId = folderWorkspaceKey(folder.id)
    const hostId = getFolderWorkspaceWorktreeHostId(folder)
    const markRepo = folderMarkByWorktreeId.get(wtId) ?? buildFolderRepoMark(folder)
    const openTabCount = countOpenTabs(wtId, args.tabsByWorktree, args.browserTabsByWorktree, excludedBotSessionIds)
    const threadTone = toneByWorktreeId.get(wtId) ?? 'idle'
    const statusTone = threadTone !== 'idle' ? threadTone : folder.isUnread ? 'active' : 'idle'
    const lastActivityAt = Math.max(folder.lastActivityAt ?? 0, latestThreadAtByWorktreeId.get(wtId) ?? 0)
    const isActive = args.activeWorktreeId === wtId
    const item: CodexProjectWorktreeItem = {
      id: wtId,
      hostId,
      label: folder.name,
      branch: '',
      isMain: true,
      isActive,
      isPinned: folder.isPinned,
      openTabCount,
      statusTone,
      lastActivityAt
    }

    projects.push({
      key: `folder:${folder.id}`,
      kind: 'folder',
      name: folder.name,
      repo: null,
      markRepo,
      primaryWorktree: item,
      worktrees: [item],
      openTabCount,
      isActive,
      isPinned: folder.isPinned,
      statusTone,
      lastActivityAt,
      addedAt: folder.createdAt
    })

    if (!worktreeIdsWithThread.has(wtId) && (openTabCount > 0 || lastActivityAt > 0 || isActive)) {
      allRecentRows.push(
        makeCodexFallbackRecentRow({
          title: folder.name,
          projectName: folder.name,
          worktreeId: wtId,
          hostId,
          markRepo,
          statusTone,
          isActive,
          isUnread: folder.isUnread,
          timestamp: lastActivityAt
        })
      )
    }
  }

  projects.sort(
    (a, b) =>
      Number(b.isPinned) - Number(a.isPinned) ||
      b.lastActivityAt - a.lastActivityAt ||
      b.addedAt - a.addedAt ||
      a.name.localeCompare(b.name)
  )
  allRecentRows.sort(
    (a, b) =>
      b.timestamp - a.timestamp ||
      CODEX_TONE_PRIORITY[b.statusTone] - CODEX_TONE_PRIORITY[a.statusTone] ||
      a.title.localeCompare(b.title)
  )

  const recentItems = args.onlyActiveRecent
    ? allRecentRows.filter(
        (row) => row.statusTone === 'working' || row.statusTone === 'attention' || row.isUnread || row.isActive
      )
    : allRecentRows

  return { projects, recentItems, totalRecentCount: allRecentRows.length }
}
