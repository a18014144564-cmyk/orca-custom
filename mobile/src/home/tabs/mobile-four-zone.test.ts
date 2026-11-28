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
import { buildFiveSlotMobileTabs, FOUR_ZONE_HOME_TABS } from './home-tabs'
import { buildMobileRunningWindows, countActiveMobileRunningWindows } from './mobile-running-windows'
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

  it('places the center Running tab squarely in the middle of 5 slots and filters cross-device windows by idle timeout & dismissal', () => {
    expect(buildFiveSlotMobileTabs(FOUR_ZONE_HOME_TABS)).toEqual([
      'teams',
      'bots',
      'running',
      'projects',
      'usage'
    ])

    const now = 10_000_000
    const winHost = { id: 'win-1', name: '台式机 Win', credentialStatus: 'paired' } as unknown as Parameters<typeof buildMobileRunningWindows>[0]['hosts'][number]
    const macHost = { id: 'mac-1', name: 'MacBook Pro', credentialStatus: 'paired' } as unknown as Parameters<typeof buildMobileRunningWindows>[0]['hosts'][number]
    const botRows = [
      {
        key: 'b-run',
        kind: 'bot' as const,
        pairedHostId: 'mac-1',
        hostLabel: 'MacBook Pro',
        title: 'Mac 助手',
        preview: '正在跑任务',
        needsYou: 0,
        dot: 'working' as const,
        activityAt: now - 5 * 60_000,
        unread: false
      },
      {
        key: 'b-recent-idle',
        kind: 'group' as const,
        pairedHostId: 'win-1',
        hostLabel: '台式机 Win',
        title: '研发群',
        preview: '10分钟前聊过',
        needsYou: 0,
        dot: 'active' as const,
        activityAt: now - 10 * 60_000,
        unread: false
      },
      {
        key: 'b-stale-idle',
        kind: 'bot' as const,
        pairedHostId: 'win-1',
        hostLabel: '台式机 Win',
        title: '旧窗口',
        preview: '2小时前聊过',
        needsYou: 0,
        dot: 'active' as const,
        activityAt: now - 120 * 60_000,
        unread: false
      }
    ] as unknown as HomeBotRow[]

    const model = buildMobileRunningWindows({
      hosts: [winHost, macHost],
      winHostIds: new Set(['win-1']),
      macHostIds: new Set(['mac-1']),
      hostStates: { 'win-1': 'connected', 'mac-1': 'connected' },
      worktreeInfo: {},
      botRows,
      botHomeWorktreeIds: new Set(),
      prefs: { idleHideMs: 30 * 60_000, groupByDevice: false, dismissedAtByKey: {} },
      now
    })
    expect(model.items.map((i) => `${i.platform}:${i.title}:${i.status}`)).toEqual([
      'mac:Mac 助手:working',
      'win:研发群:idle'
    ])
    expect(model.activeCount).toBe(1)
    expect(model.idleCount).toBe(1)

    // Dismissing idle windows clears only idle ones; running windows remain protected.
    const afterClear = buildMobileRunningWindows({
      hosts: [winHost, macHost],
      winHostIds: new Set(['win-1']),
      macHostIds: new Set(['mac-1']),
      hostStates: { 'win-1': 'connected', 'mac-1': 'connected' },
      worktreeInfo: {},
      botRows,
      botHomeWorktreeIds: new Set(),
      prefs: {
        idleHideMs: 30 * 60_000,
        groupByDevice: false,
        dismissedAtByKey: { 'bot:b-recent-idle': now, 'bot:b-run': now }
      },
      now
    })
    expect(afterClear.items.map((i) => i.title)).toEqual(['Mac 助手'])
  })

  it('excludes team-dispatched worker tasks (workspace-prefixed lineage, childOf verdict, bot-home children) from Running windows', () => {
    const now = 20_000_000
    const winHost = { id: 'win-1', name: 'Win 主机', credentialStatus: 'paired' } as unknown as Parameters<typeof buildMobileRunningWindows>[0]['hosts'][number]
    const worktreeInfo: Record<string, HostWorktreeInfo> = {
      'win-1': {
        hostId: 'win-1',
        totalWorktrees: 4,
        activeCount: 4,
        rows: [
          { worktreeId: 'wt-normal', repo: 'app', displayName: 'main', branch: 'main', liveTerminalCount: 1 } as unknown as Worktree,
          { worktreeId: 'wt-orch-git', repo: 'app', displayName: 'team-task', branch: 'feat/task', liveTerminalCount: 1 } as unknown as Worktree,
          { worktreeId: 'wt-bot-child', repo: 'app', displayName: 'bot-child', branch: 'feat/child', parentWorktreeId: 'folder:bot-home-1', liveTerminalCount: 1 } as unknown as Worktree
        ],
        workspaceLineage: {
          'worktree:wt-orch-git': {
            childWorkspaceKey: 'worktree:wt-orch-git',
            parentWorkspaceKey: 'folder:team-1',
            origin: 'orchestration',
            capture: { source: 'orchestration-context', confidence: 'explicit' },
            createdAt: now - 10_000
          }
        },
        agents: [
          {
            worktreeId: 'wt-normal',
            workspaceName: 'main',
            repo: 'app',
            branch: 'main',
            agent: {
              paneKey: 'tab-user:leaf-1',
              parentPaneKey: null,
              state: 'working',
              prompt: '正常用户任务',
              taskTitle: '正常用户任务',
              displayName: null,
              stateStartedAt: now - 5_000,
              updatedAt: now - 5_000
            }
          },
          {
            worktreeId: 'wt-normal',
            workspaceName: 'main',
            repo: 'app',
            branch: 'main',
            agent: {
              paneKey: 'tab-verdict-child:leaf-2',
              parentPaneKey: null,
              state: 'working',
              prompt: '团队下发子任务(verdict childOf)',
              taskTitle: '团队下发子任务(verdict childOf)',
              displayName: null,
              stateStartedAt: now - 4_000,
              updatedAt: now - 4_000,
              activity: {
                listed: true,
                status: 'working',
                unread: false,
                clearable: false,
                sortAt: now - 4_000,
                title: '团队下发子任务(verdict childOf)',
                childOf: 'tab-team:coord'
              }
            }
          },
          {
            worktreeId: 'wt-orch-git',
            workspaceName: 'team-task',
            repo: 'app',
            branch: 'feat/task',
            agent: {
              paneKey: 'tab-orch:leaf-3',
              parentPaneKey: null,
              state: 'working',
              prompt: '团队下发 git worktree 任务',
              taskTitle: '团队下发 git worktree 任务',
              displayName: null,
              stateStartedAt: now - 3_000,
              updatedAt: now - 3_000
            }
          },
          {
            worktreeId: 'wt-bot-child',
            workspaceName: 'bot-child',
            repo: 'app',
            branch: 'feat/child',
            agent: {
              paneKey: 'tab-bot-child:leaf-4',
              parentPaneKey: null,
              state: 'working',
              prompt: 'Bot 子工作区任务',
              taskTitle: 'Bot 子工作区任务',
              displayName: null,
              stateStartedAt: now - 2_000,
              updatedAt: now - 2_000
            }
          }
        ] as unknown as HostWorktreeInfo['agents']
      }
    }

    const activeCount = countActiveMobileRunningWindows({
      hosts: [winHost],
      hostStates: { 'win-1': 'connected' },
      worktreeInfo,
      botRows: [],
      botHomeWorktreeIds: new Set(['folder:bot-home-1']),
      now
    })
    const model = buildMobileRunningWindows({
      hosts: [winHost],
      winHostIds: new Set(['win-1']),
      macHostIds: new Set(),
      hostStates: { 'win-1': 'connected' },
      worktreeInfo,
      botRows: [],
      botHomeWorktreeIds: new Set(['folder:bot-home-1']),
      prefs: { idleHideMs: 30 * 60_000, groupByDevice: false, dismissedAtByKey: {} },
      now
    })

    expect(activeCount).toBe(1)
    expect(model.items.map((i) => i.title)).toEqual(['正常用户任务'])
  })

  it('excludes team member bots working on team-dispatched tasks unless directly chatted 1-on-1', () => {
    const now = 30_000_000
    const winHost = { id: 'win-1', name: 'DESKTOP-P3UU2A1', credentialStatus: 'paired' } as unknown as Parameters<typeof buildMobileRunningWindows>[0]['hosts'][number]
    const botRows = [
      {
        key: 'place-1\ngroup:team-1',
        placeKey: 'place-1',
        kind: 'group' as const,
        pairedHostId: 'win-1',
        hostLabel: 'DESKTOP-P3UU2A1',
        title: '风神开发团队',
        preview: '大明白: NO_REPLY',
        needsYou: 0,
        dot: 'working' as const,
        activityAt: now - 10_000,
        unread: false,
        group: {
          id: 'team-1',
          members: [
            { botId: 'bot-dev', sessionId: 'bot-group-member-dev' },
            { botId: 'bot-pm', sessionId: 'bot-group-member-pm' }
          ],
          threads: []
        }
      },
      {
        key: 'place-1\nbot:bot-dev',
        placeKey: 'place-1',
        kind: 'bot' as const,
        pairedHostId: 'win-1',
        hostLabel: 'DESKTOP-P3UU2A1',
        title: '风神开发手',
        preview: '1 个工作中',
        line: { kind: 'workingElsewhere' as const, count: 1 },
        needsYou: 0,
        dot: 'working' as const,
        activityAt: now - 5_000,
        unread: false,
        bot: { id: 'bot-dev', name: '风神开发手', chatSessionId: 'chat-dev-direct' }
      },
      {
        key: 'place-1\nbot:bot-pm',
        placeKey: 'place-1',
        kind: 'bot' as const,
        pairedHostId: 'win-1',
        hostLabel: 'DESKTOP-P3UU2A1',
        title: '产品经理 Bot',
        preview: '正在回复你的单聊',
        line: { kind: 'activity' as const, place: null, text: '正在回复你的单聊', at: now - 2_000 },
        needsYou: 0,
        dot: 'working' as const,
        activityAt: now - 2_000,
        unread: false,
        bot: { id: 'bot-pm', name: '产品经理 Bot', chatSessionId: 'chat-pm-direct' }
      }
    ] as unknown as HomeBotRow[]

    const worktreeInfo: Record<string, HostWorktreeInfo> = {
      'win-1': {
        hostId: 'win-1',
        totalWorktrees: 2,
        activeCount: 2,
        rows: [],
        agents: [
          {
            worktreeId: 'folder:bot-dev',
            workspaceName: '风神开发手',
            repo: 'Bots',
            branch: '',
            agent: {
              paneKey: 'structured-agent-session-bot-group-member-dev:bot-group-member-dev',
              orcaSessionId: 'bot-group-member-dev',
              parentPaneKey: null,
              state: 'working',
              prompt: '团队下发任务',
              taskTitle: null,
              displayName: null,
              stateStartedAt: now - 5_000,
              updatedAt: now - 5_000
            }
          },
          {
            worktreeId: 'folder:bot-pm',
            workspaceName: '产品经理 Bot',
            repo: 'Bots',
            branch: '',
            agent: {
              paneKey: 'structured-agent-session-chat-pm-direct:chat-pm-direct',
              orcaSessionId: 'chat-pm-direct',
              parentPaneKey: null,
              state: 'working',
              prompt: '用户单聊需求',
              taskTitle: null,
              displayName: null,
              stateStartedAt: now - 2_000,
              updatedAt: now - 2_000
            }
          }
        ] as unknown as HostWorktreeInfo['agents']
      }
    }

    const activeCount = countActiveMobileRunningWindows({
      hosts: [winHost],
      hostStates: { 'win-1': 'connected' },
      worktreeInfo,
      botRows,
      botHomeWorktreeIds: new Set(['folder:bot-dev', 'folder:bot-pm']),
      now
    })
    const model = buildMobileRunningWindows({
      hosts: [winHost],
      winHostIds: new Set(['win-1']),
      macHostIds: new Set(),
      hostStates: { 'win-1': 'connected' },
      worktreeInfo,
      botRows,
      botHomeWorktreeIds: new Set(['folder:bot-dev', 'folder:bot-pm']),
      prefs: { idleHideMs: 30 * 60_000, groupByDevice: false, dismissedAtByKey: {} },
      now
    })

    // 风神开发手 is working only via team dispatch (no 1-on-1 direct chat) -> excluded!
    // 风神开发团队 (the team itself) + 产品经理 Bot (active 1-on-1 direct chat) -> included!
    expect(activeCount).toBe(2)
    expect(model.items.map((i) => i.title)).toEqual(['产品经理 Bot', '风神开发团队'])
  })

  it('rolls mail/item-dispatched team member Home Chat turns up to the owning Bot Team instead of showing a standalone Bot card', () => {
    const now = 40_000_000
    const winHost = { id: 'win-1', name: 'DESKTOP-P3UU2A1', credentialStatus: 'paired' } as unknown as Parameters<typeof buildMobileRunningWindows>[0]['hosts'][number]
    const botRows = [
      {
        key: 'place-1\ngroup:team-1',
        placeKey: 'place-1',
        kind: 'group' as const,
        pairedHostId: 'win-1',
        hostLabel: 'DESKTOP-P3UU2A1',
        title: '风神开发团队',
        preview: '大明白: 已交由风神开发手处理 Item #76',
        needsYou: 0,
        dot: null,
        activityAt: now - 60 * 60_000,
        unread: false,
        group: {
          id: 'team-1',
          members: [{ botId: 'bot-dev', sessionId: 'bot-group-member-dev' }],
          threads: []
        }
      },
      {
        key: 'place-1\nbot:bot-dev',
        placeKey: 'place-1',
        kind: 'bot' as const,
        pairedHostId: 'win-1',
        hostLabel: 'DESKTOP-P3UU2A1',
        title: '风神开发手',
        preview: 'mcp_agy-fast_fast_run_checks: ...',
        line: { kind: 'activity' as const, place: null, text: 'mcp_agy-fast_fast_run_checks: ...', at: now - 1_000 },
        needsYou: 0,
        dot: 'working' as const,
        activityAt: now - 1_000,
        unread: false,
        bot: { id: 'bot-dev', name: '风神开发手', chatSessionId: 'chat-dev-direct' }
      }
    ] as unknown as HomeBotRow[]

    const worktreeInfo: Record<string, HostWorktreeInfo> = {
      'win-1': {
        hostId: 'win-1',
        totalWorktrees: 1,
        activeCount: 1,
        rows: [],
        agents: [
          {
            worktreeId: 'folder:bot-dev',
            workspaceName: '风神开发手',
            repo: 'Bots',
            branch: '',
            agent: {
              paneKey: 'structured-agent-session-chat-dev-direct:chat-dev-direct',
              orcaSessionId: 'chat-dev-direct',
              parentPaneKey: null,
              state: 'working',
              prompt: '──── From: 大明白 (bot-group-member-lead) (handoff) ────\nSubject: New item: Item #76\nAn item was added for you: "Item #76".',
              taskTitle: null,
              displayName: null,
              stateStartedAt: now - 10_000,
              updatedAt: now - 1_000
            }
          }
        ] as unknown as HostWorktreeInfo['agents']
      }
    }

    const activeCount = countActiveMobileRunningWindows({
      hosts: [winHost],
      hostStates: { 'win-1': 'connected' },
      worktreeInfo,
      botRows,
      botHomeWorktreeIds: new Set(['folder:bot-dev']),
      now
    })
    const model = buildMobileRunningWindows({
      hosts: [winHost],
      winHostIds: new Set(['win-1']),
      macHostIds: new Set(),
      hostStates: { 'win-1': 'connected' },
      worktreeInfo,
      botRows,
      botHomeWorktreeIds: new Set(['folder:bot-dev']),
      prefs: { idleHideMs: 30 * 60_000, groupByDevice: false, dismissedAtByKey: {} },
      now
    })

    expect(activeCount).toBe(1)
    expect(model.items.map((i) => `${i.kind}:${i.title}:${i.status}:${i.subtitle}`)).toEqual([
      'team:风神开发团队:working:风神开发手 正在执行团队任务'
    ])
  })
})
