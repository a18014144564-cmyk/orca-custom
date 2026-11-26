import { describe, expect, it } from 'vitest'
import {
  countBotRowsNeedsYou,
  countNeedsYouForHostIds,
  filterAgentRowsByHostIds,
  filterHomeBotRowsByKind,
  partitionMobileHostsByPlatform,
  resolveMobileHostPlatformBucket
} from './mobile-four-zone'
import type { HostMachineDescriptor } from '../../host-descriptors/host-descriptor-store'
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
})
