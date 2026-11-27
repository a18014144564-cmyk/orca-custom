import { describe, expect, it, vi } from 'vitest'

vi.mock('react-native-reanimated', () => ({
  Easing: { bezier: () => (v: number) => v }
}))

import {
  buildPlatformProjectGroups,
  countBotRowsNeedsYou,
  countNeedsYouForHostIds,
  countPlatformProjectItems,
  filterAgentRowsByHostIds,
  filterHomeBotRowsByKind,
  partitionMobileHostsByPlatform,
  resolveMobileHostPlatformBucket,
  resolvePlatformConnectionHealth
} from './mobile-four-zone'
import { FOUR_ZONE_HOME_TABS } from './home-tabs'
import {
  moveMobileTabByOffset,
  moveMobileTabToFirst,
  normalizeMobileFourZoneTabOrder
} from './mobile-tab-order'
import {
  buildMobileCodexProjectsModel,
  formatMobileRelativeTime
} from './mobile-codex-projects'
import type { HostCatalogEntry } from '../../host-catalog/host-profile'
import type { HostMachineDescriptor } from '../../host-descriptors/host-descriptor-store'
import type { HostWorktreeInfo } from '../../worktree/catalog/home-worktree-info'
import type { Worktree } from '../../worktree/workspace-list/workspace-list-types'
import type { HomeBotRow } from '../bots/home-bot-rows'
import type { AgentListRow } from '../../agents/agent-list-rows'

describe('mobile-four-zone', () => {
  it('partitions paired hosts into Win, Mac, and Other using live descriptors, stored platform, and name fallback', () => {
    const descriptors = new Map<string, HostMachineDescriptor>([
      ['host-win', { machineName: 'Desktop-Win', platform: 'win32' }],
      ['host-override', { machineName: 'Studio', platform: 'darwin' }]
    ])

    const hosts = [
      { id: 'host-win', name: 'Office', lastKnownHostPlatform: undefined },
      { id: 'host-mac-stored', name: 'Work Laptop', lastKnownHostPlatform: 'darwin' as const },
      { id: 'host-override', name: 'Legacy Win', lastKnownHostPlatform: 'win32' as const },
      { id: 'host-offline-mac', name: 'MacBook Air', lastKnownHostPlatform: undefined },
      { id: 'host-offline-win', name: 'Win11 Home', lastKnownHostPlatform: undefined },
      { id: 'host-linux', name: 'Prod Box', lastKnownHostPlatform: 'linux' as const }
    ]

    const result = partitionMobileHostsByPlatform(hosts, descriptors)
    expect(result.winHosts.map((h) => h.id)).toEqual(['host-win', 'host-offline-win'])
    expect(result.macHosts.map((h) => h.id)).toEqual([
      'host-mac-stored',
      'host-override',
      'host-offline-mac'
    ])
    expect(result.otherHosts.map((h) => h.id)).toEqual(['host-linux'])
  })

  it('prefers live descriptor platform over stale stored platform', () => {
    const bucket = resolveMobileHostPlatformBucket(
      { id: 'h1', name: 'mac', lastKnownHostPlatform: 'darwin' },
      { machineName: 'win-box', platform: 'win32' }
    )
    expect(bucket).toBe('win')
  })

  it('separates bot teams from individual bots and counts needsYou badges per tab', () => {
    const rows = [
      { kind: 'group', key: 'g1', needsYou: 2 },
      { kind: 'bot', key: 'b1', needsYou: 1 },
      { kind: 'bot', key: 'b2', needsYou: 3 },
      { kind: 'group', key: 'g2', needsYou: 0 }
    ] as unknown as HomeBotRow[]

    const teams = filterHomeBotRowsByKind(rows, 'group')
    const bots = filterHomeBotRowsByKind(rows, 'bot')

    expect(teams).toHaveLength(2)
    expect(bots).toHaveLength(2)
    expect(countBotRowsNeedsYou(teams)).toBe(2)
    expect(countBotRowsNeedsYou(bots)).toBe(4)
  })

  it('filters active agents and aggregates needsYou badges by host IDs', () => {
    const agents = [
      { key: 'a1', hostId: 'win-1' },
      { key: 'a2', hostId: 'mac-1' },
      { key: 'a3', hostId: 'win-2' }
    ] as unknown as AgentListRow[]

    expect(filterAgentRowsByHostIds(agents, ['win-1', 'win-2']).map((a) => a.key)).toEqual([
      'a1',
      'a3'
    ])
    expect(filterAgentRowsByHostIds(agents, ['mac-1']).map((a) => a.key)).toEqual(['a2'])
    expect(filterAgentRowsByHostIds(agents, [])).toEqual([])
    expect(countNeedsYouForHostIds({ 'win-1': 2, 'mac-1': 5, 'win-2': 1 }, ['win-1', 'win-2'])).toBe(
      3
    )
  })

  it('orders four-zone tabs as teams, bots, merged projects, and native usage', () => {
    expect(FOUR_ZONE_HOME_TABS).toEqual(['teams', 'bots', 'projects', 'usage'])
  })

  it('reports green (healthy) only when platform hosts exist and all are connected', () => {
    expect(resolvePlatformConnectionHealth([], {})).toBe('abnormal')
    expect(resolvePlatformConnectionHealth([{ id: 'win-1' }], { 'win-1': 'connected' })).toBe(
      'healthy'
    )
    expect(resolvePlatformConnectionHealth([{ id: 'win-1' }], { 'win-1': 'disconnected' })).toBe(
      'abnormal'
    )
    expect(
      resolvePlatformConnectionHealth([{ id: 'win-1' }, { id: 'win-2' }], {
        'win-1': 'connected',
        'win-2': 'connecting'
      })
    ).toBe('abnormal')
  })

  it('groups non-archived, non-bot project worktrees by repo and prioritizes working/pinned items', () => {
    const winHost = { id: 'win-1', name: 'DESKTOP-WIN' } as HostCatalogEntry
    const rows = [
      {
        worktreeId: 'repo-a::/a/idle',
        repo: 'alpha',
        displayName: 'idle-wt',
        branch: 'refs/heads/main',
        status: 'inactive',
        liveTerminalCount: 0,
        lastActivityAt: 100
      },
      {
        worktreeId: 'repo-b::/b/working',
        repo: 'beta',
        displayName: 'active-wt',
        branch: 'refs/heads/feat/ui',
        status: 'working',
        liveTerminalCount: 1,
        lastActivityAt: 200
      },
      {
        worktreeId: 'repo-a::/a/archived',
        repo: 'alpha',
        displayName: 'old-wt',
        branch: 'refs/heads/old',
        isArchived: true,
        liveTerminalCount: 0
      },
      {
        worktreeId: 'folder:bot-1',
        repo: 'Bots',
        displayName: 'MyBot',
        branch: '',
        botHome: true,
        liveTerminalCount: 0
      },
      {
        worktreeId: 'folder:bot-extra',
        repo: 'Other',
        displayName: 'HiddenBot',
        branch: '',
        liveTerminalCount: 0
      }
    ] as unknown as Worktree[]

    const worktreeInfo: Record<string, HostWorktreeInfo> = {
      'win-1': { hostId: 'win-1', totalWorktrees: 2, activeCount: 1, rows }
    }

    const groups = buildPlatformProjectGroups({
      hosts: [winHost],
      worktreeInfo,
      botHomeWorktreeIds: new Set(['folder:bot-extra'])
    })

    expect(groups.map((g) => g.repo)).toEqual(['beta', 'alpha'])
    expect(groups[0]?.items.map((i) => i.row.displayName)).toEqual(['active-wt'])
    expect(groups[1]?.items.map((i) => i.row.displayName)).toEqual(['idle-wt'])
    expect(countPlatformProjectItems(groups)).toBe(2)
  })

  it('normalizes and reorders customizable mobile four-zone bottom tabs', () => {
    expect(normalizeMobileFourZoneTabOrder(['projects', 'teams', 'projects', 'bad'])).toEqual([
      'projects',
      'teams',
      'bots',
      'usage'
    ])
    expect(moveMobileTabToFirst(FOUR_ZONE_HOME_TABS, 'projects')).toEqual([
      'projects',
      'teams',
      'bots',
      'usage'
    ])
    expect(moveMobileTabByOffset(FOUR_ZONE_HOME_TABS, 'bots', -1)).toEqual([
      'bots',
      'teams',
      'projects',
      'usage'
    ])
    expect(moveMobileTabByOffset(FOUR_ZONE_HOME_TABS, 'usage', 1)).toEqual([
      'teams',
      'bots',
      'projects',
      'usage'
    ])
  })

  it('builds Mobile Codex Projects + Recent model while excluding Bot Team chats and orchestration workers', () => {
    const winHost = { id: 'win-1', name: 'DESKTOP-WIN' } as HostCatalogEntry
    const rows = [
      {
        worktreeId: 'wt-main',
        repoId: 'r-1',
        repo: 'fengshen-github',
        displayName: 'main',
        branch: 'refs/heads/main',
        status: 'working',
        liveTerminalCount: 1,
        lastActivityAt: 5000,
        createdAt: 1000
      },
      {
        worktreeId: 'wt-worker',
        repoId: 'r-1',
        repo: 'fengshen-github',
        displayName: 'fengshen-github-explore',
        branch: 'refs/heads/explore',
        bot: 'bot-1',
        status: 'working',
        liveTerminalCount: 1,
        lastActivityAt: 9000,
        createdAt: 2000
      },
      {
        worktreeId: 'wt-orch',
        repoId: 'r-1',
        repo: 'fengshen-github',
        displayName: 'orch-worker',
        branch: 'refs/heads/orch',
        status: 'working',
        liveTerminalCount: 1,
        lastActivityAt: 9500,
        createdAt: 2500
      }
    ] as unknown as Worktree[]

    const agents = [
      {
        worktreeId: 'wt-main',
        workspaceName: 'main',
        repo: 'fengshen-github',
        branch: 'main',
        agent: {
          paneKey: 'tab-user:leaf-1',
          parentPaneKey: null,
          state: 'working',
          prompt: '优化侧边栏',
          taskTitle: '优化侧边栏',
          displayName: null,
          stateStartedAt: 6000,
          updatedAt: 6000
        }
      },
      {
        worktreeId: 'wt-main',
        workspaceName: 'main',
        repo: 'fengshen-github',
        branch: 'main',
        agent: {
          paneKey: 'structured-agent-session-bot-group-member-1:bot-group-member-1',
          orcaSessionId: 'bot-group-member-1',
          parentPaneKey: null,
          state: 'working',
          prompt: '团队群聊发言',
          taskTitle: '团队群聊发言',
          displayName: null,
          stateStartedAt: 8000,
          updatedAt: 8000
        }
      },
      {
        worktreeId: 'wt-main',
        workspaceName: 'main',
        repo: 'fengshen-github',
        branch: 'main',
        agent: {
          paneKey: 'tab-worker:leaf-2',
          parentPaneKey: 'tab-coord:leaf-0',
          state: 'working',
          prompt: '你是风神项目的开发 Worker',
          taskTitle: '你是风神项目的开发 Worker',
          displayName: null,
          stateStartedAt: 8500,
          updatedAt: 8500
        }
      }
    ] as unknown as HostWorktreeInfo['agents']

    const worktreeInfo: Record<string, HostWorktreeInfo> = {
      'win-1': {
        hostId: 'win-1',
        totalWorktrees: 3,
        activeCount: 3,
        rows,
        agents,
        workspaceLineage: {
          'wt-orch': {
            childWorkspaceKey: 'wt-orch',
            parentWorkspaceKey: 'folder:group-1',
            origin: 'orchestration',
            capture: { source: 'orchestration-context', confidence: 'explicit' },
            createdAt: 2500
          }
        }
      }
    }

    const model = buildMobileCodexProjectsModel({
      hosts: [winHost],
      worktreeInfo,
      hostStates: { 'win-1': 'connected' },
      botHomeWorktreeIds: new Set(),
      onlyActiveRecent: false,
      now: 10_000
    })

    expect(model.projects).toHaveLength(1)
    expect(model.projects[0]?.repo).toBe('fengshen-github')
    expect(model.projects[0]?.items.map((i) => i.row.worktreeId)).toEqual(['wt-main'])
    expect(model.projects[0]?.markIcon.type).toBe('letters')
    expect(model.recentItems.map((r) => r.title)).toEqual(['优化侧边栏'])
    const now = 1_700_000_000_000
    expect(formatMobileRelativeTime(now - 10_000, now)).toBe('刚刚')
    expect(formatMobileRelativeTime(now - 120_000, now)).toBe('2m')
    expect(formatMobileRelativeTime(now - 7_200_000, now)).toBe('2h')
  })
})
