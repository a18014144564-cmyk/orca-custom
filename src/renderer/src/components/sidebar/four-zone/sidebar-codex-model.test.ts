import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SIDEBAR_ZONE_ORDER,
  moveSidebarZoneByOffset,
  moveSidebarZoneInOrder,
  moveSidebarZoneToFirst,
  normalizeSidebarZoneOrder
} from './sidebar-four-zone-model'
import { buildCodexSidebarModel, formatCodexRelativeTime } from './sidebar-codex-model'
import type { Repo } from '../../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import type { FolderWorkspace } from '../../../../../shared/folder-workspaces/folder-workspace-types'
import type { ExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import type { AgentPaneThread } from '@/components/activity/threads/activity-thread-types'

function makeRepo(overrides: Partial<Repo> & { id: string; displayName: string }): Repo {
  return {
    path: `/repos/${overrides.id}`,
    badgeColor: 'auto',
    addedAt: 1000,
    ...overrides
  } as Repo
}

function makeWorktree(overrides: Partial<Worktree> & { id: string; repoId: string }): Worktree {
  return {
    displayName: overrides.id,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 1000,
    path: `/wt/${overrides.id}`,
    head: 'abc',
    branch: 'refs/heads/main',
    isBare: false,
    isMainWorktree: true,
    ...overrides
  } as Worktree
}

function makeFolder(
  overrides: Partial<FolderWorkspace> & { id: string; name: string }
): FolderWorkspace {
  return {
    projectGroupId: 'default',
    folderPath: `/folders/${overrides.id}`,
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 1000,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides
  }
}

function makeThread(args: {
  paneKey: string
  paneTitle: string
  worktree: Worktree
  repo: Repo | null
  state?: AgentPaneThread['currentAgentState']
  latestTimestamp: number
  unread?: boolean
}): AgentPaneThread {
  return {
    paneKey: args.paneKey,
    paneTitle: args.paneTitle,
    worktree: args.worktree,
    repo: args.repo,
    tab: { id: args.paneKey.split(':')[0] } as AgentPaneThread['tab'],
    agentType: 'claude',
    currentAgentState: args.state ?? null,
    currentAgentEntry: null,
    responsePreview: '',
    latestTimestamp: args.latestTimestamp,
    latestEvent: null,
    events: [],
    unread: args.unread ?? false
  }
}

describe('sidebar zone custom ordering', () => {
  it('normalizes partial, duplicate, or invalid orders while preserving every zone', () => {
    expect(normalizeSidebarZoneOrder(['mac', 'win', 'mac', 'bogus'])).toEqual([
      'mac',
      'win',
      'teams',
      'bots',
      'all'
    ])
    expect(normalizeSidebarZoneOrder(null)).toEqual([...DEFAULT_SIDEBAR_ZONE_ORDER])
  })

  it('supports drag reorder, move-to-first, and single-step moves', () => {
    const start = [...DEFAULT_SIDEBAR_ZONE_ORDER]
    expect(moveSidebarZoneToFirst(start, 'mac')).toEqual(['mac', 'teams', 'bots', 'win', 'all'])
    expect(moveSidebarZoneInOrder(start, 'win', 'teams')).toEqual([
      'win',
      'teams',
      'bots',
      'mac',
      'all'
    ])
    expect(moveSidebarZoneByOffset(start, 'bots', -1)).toEqual([
      'bots',
      'teams',
      'win',
      'mac',
      'all'
    ])
    expect(moveSidebarZoneByOffset(start, 'all', 1)).toEqual(start)
  })
})

describe('buildCodexSidebarModel', () => {
  const macHost = 'runtime:mac-1' as ExecutionHostId
  const winHost = 'local' as ExecutionHostId

  it('filters projects and threads by host, excludes bot homes and hidden/archived items, and counts tabs', () => {
    const repoWin = makeRepo({ id: 'r-win', displayName: 'orca-custom', executionHostId: winHost })
    const repoMac = makeRepo({ id: 'r-mac', displayName: 'mac-app', executionHostId: macHost })
    const repoHidden = makeRepo({
      id: 'r-hidden',
      displayName: 'secret',
      executionHostId: winHost,
      hiddenAt: 500
    })

    const wtMain = makeWorktree({
      id: 'wt-main',
      repoId: 'r-win',
      displayName: 'main',
      branch: 'refs/heads/main',
      hostId: winHost,
      lastActivityAt: 3000
    })
    const wtFeat = makeWorktree({
      id: 'wt-feat',
      repoId: 'r-win',
      displayName: 'feat-ui',
      branch: 'refs/heads/feat/ui',
      isMainWorktree: false,
      hostId: winHost,
      lastActivityAt: 5000
    })
    const wtArchived = makeWorktree({
      id: 'wt-archived',
      repoId: 'r-win',
      displayName: 'old',
      isArchived: true,
      hostId: winHost,
      lastActivityAt: 9000
    })
    const wtMac = makeWorktree({
      id: 'wt-mac',
      repoId: 'r-mac',
      displayName: 'mac-main',
      hostId: macHost,
      lastActivityAt: 6000
    })

    const folderUser = makeFolder({
      id: 'f-user',
      name: '桌面整理',
      executionHostId: winHost,
      lastActivityAt: 4000
    })
    const folderBotHome = makeFolder({
      id: 'f-bot',
      name: 'Bot Home',
      executionHostId: winHost,
      lastActivityAt: 8000
    })

    const threadWorking = makeThread({
      paneKey: 'tab-1:leaf-1',
      paneTitle: '优化 Win/Mac 侧边栏',
      worktree: wtFeat,
      repo: repoWin,
      state: 'working',
      latestTimestamp: 7000
    })
    const threadMac = makeThread({
      paneKey: 'tab-2:leaf-1',
      paneTitle: 'Mac 调试',
      worktree: wtMac,
      repo: repoMac,
      state: 'working',
      latestTimestamp: 9500
    })

    const model = buildCodexSidebarModel({
      repos: [repoWin, repoMac, repoHidden],
      worktreesByRepo: {
        'r-win': [wtMain, wtFeat, wtArchived],
        'r-mac': [wtMac],
        'r-hidden': [makeWorktree({ id: 'wt-h', repoId: 'r-hidden', hostId: winHost })]
      },
      folderWorkspaces: [folderUser, folderBotHome],
      botHomeOwners: [{ folderWorkspaceId: 'f-bot', hostId: winHost }],
      allThreads: [threadWorking, threadMac],
      tabsByWorktree: {
        'wt-main': [{}, {}],
        'wt-feat': [{}]
      },
      browserTabsByWorktree: {
        'wt-feat': [{}]
      },
      hostIds: [winHost],
      defaultHostId: winHost,
      activeWorktreeId: 'wt-main',
      selectedPaneKey: null,
      onlyActiveRecent: false
    })

    expect(model.projects.map((p) => p.name)).toEqual(['orca-custom', '桌面整理'])
    expect(model.projects[0].worktrees).toHaveLength(2)
    expect(model.projects[0].openTabCount).toBe(4)
    expect(model.projects[0].primaryWorktree.id).toBe('wt-main')
    expect(model.projects[0].statusTone).toBe('working')

    expect(model.recentItems.map((r) => r.title)).toEqual([
      '优化 Win/Mac 侧边栏',
      '桌面整理',
      'main'
    ])
    expect(model.recentItems[0].statusTone).toBe('working')
  })

  it('filters recent items to active/working/unread when onlyActiveRecent is enabled', () => {
    const repo = makeRepo({ id: 'r1', displayName: 'demo', executionHostId: winHost })
    const wt = makeWorktree({ id: 'w1', repoId: 'r1', hostId: winHost, lastActivityAt: 2000 })
    const activeThread = makeThread({
      paneKey: 't1:l1',
      paneTitle: '运行中任务',
      worktree: wt,
      repo,
      state: 'working',
      latestTimestamp: 3000
    })
    const idleThread = makeThread({
      paneKey: 't2:l1',
      paneTitle: '历史已完成任务',
      worktree: wt,
      repo,
      state: null,
      latestTimestamp: 2500
    })

    const filtered = buildCodexSidebarModel({
      repos: [repo],
      worktreesByRepo: { r1: [wt] },
      folderWorkspaces: [],
      botHomeOwners: [],
      allThreads: [activeThread, idleThread],
      tabsByWorktree: {},
      browserTabsByWorktree: {},
      hostIds: [winHost],
      defaultHostId: winHost,
      activeWorktreeId: null,
      selectedPaneKey: null,
      onlyActiveRecent: true
    })

    expect(filtered.totalRecentCount).toBe(2)
    expect(filtered.recentItems.map((item) => item.title)).toEqual(['运行中任务'])
  })

  it('formats concise Chinese/short relative timestamps', () => {
    const now = 1_700_000_000_000
    expect(formatCodexRelativeTime(now - 10_000, now)).toBe('刚刚')
    expect(formatCodexRelativeTime(now - 5 * 60_000, now)).toBe('5m')
    expect(formatCodexRelativeTime(now - 3 * 3600_000, now)).toBe('3h')
    expect(formatCodexRelativeTime(now - 4 * 86400_000, now)).toBe('4d')
  })
})
