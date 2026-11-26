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
})
