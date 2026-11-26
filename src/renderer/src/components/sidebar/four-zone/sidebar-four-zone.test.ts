import { describe, expect, it } from 'vitest'
import {
  classifySidebarHostsByPlatform,
  inferPlatformBucketFromLabel,
  resolveZoneForWorkspaceHost,
  resolveZoneHostIdsOverride
} from './sidebar-four-zone-model'
import type { ExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import type { RuntimeEnvironmentStatus } from '../../../../../shared/remote-runtime/host-status/runtime-host-status'
import type { SshConnectionState } from '../../../../../shared/remote-runtime/ssh/ssh-types'

function makeRuntimeStatus(hostPlatform: NodeJS.Platform | null): RuntimeEnvironmentStatus {
  return {
    environmentId: 'env-1',
    status: hostPlatform
      ? ({
          hostPlatform
        } as unknown as RuntimeEnvironmentStatus['status'])
      : null
  } as unknown as RuntimeEnvironmentStatus
}

describe('sidebar-four-zone', () => {
  it('classifies local Windows host, WSL host, paired Mac runtime host, and SSH Linux host', () => {
    const runtimeStatuses = new Map<string, RuntimeEnvironmentStatus>([
      ['mac-env', makeRuntimeStatus('darwin')],
      ['win-remote', makeRuntimeStatus('win32')]
    ])
    const sshStates = new Map<string, SshConnectionState>([
      ['linux-box', { remotePlatform: 'linux' } as unknown as SshConnectionState]
    ])

    const result = classifySidebarHostsByPlatform({
      localPlatform: 'win32',
      runtimeStatusByEnvironmentId: runtimeStatuses,
      sshConnectionStates: sshStates,
      hostOptions: [
        { id: 'local', kind: 'local', label: 'This computer' },
        {
          id: 'runtime:wsl-ubuntu' as ExecutionHostId,
          kind: 'runtime',
          label: 'Ubuntu',
          wslDistro: 'Ubuntu'
        },
        {
          id: 'runtime:mac-env' as ExecutionHostId,
          kind: 'runtime',
          label: 'MacBook Pro',
          aliasHostIds: ['ssh:mac-alias' as ExecutionHostId]
        },
        {
          id: 'runtime:win-remote' as ExecutionHostId,
          kind: 'runtime',
          label: 'Office PC'
        },
        {
          id: 'ssh:linux-box' as ExecutionHostId,
          kind: 'ssh',
          label: 'Prod Server'
        }
      ]
    })

    expect(result.winHostIds).toEqual(['local', 'runtime:wsl-ubuntu', 'runtime:win-remote'])
    expect(result.winHostCount).toBe(3)
    expect(result.macHostIds).toEqual(['runtime:mac-env', 'ssh:mac-alias'])
    expect(result.macHostCount).toBe(1)
    expect(result.otherHostIds).toEqual(['ssh:linux-box'])
    expect(result.hostPlatformById.get('ssh:mac-alias' as ExecutionHostId)).toBe('mac')
  })

  it('classifies local Mac host and offline Windows host via label fallback', () => {
    const result = classifySidebarHostsByPlatform({
      localPlatform: 'darwin',
      hostOptions: [
        { id: 'local', kind: 'local', label: 'This Mac' },
        { id: 'runtime:offline-win' as ExecutionHostId, kind: 'runtime', label: 'Win11 Desktop' },
        { id: 'runtime:offline-mac' as ExecutionHostId, kind: 'runtime', label: 'macos' }
      ]
    })

    expect(result.macHostIds).toEqual(['local', 'runtime:offline-mac'])
    expect(result.winHostIds).toEqual(['runtime:offline-win'])
  })

  it('intersects zone host IDs with user-selected visible hosts when present', () => {
    const classified = {
      winHostIds: ['local', 'runtime:win-2'] as ExecutionHostId[],
      macHostIds: ['runtime:mac-1'] as ExecutionHostId[]
    }

    expect(resolveZoneHostIdsOverride('all', classified, null)).toBeNull()
    expect(resolveZoneHostIdsOverride('teams', classified, null)).toBeNull()
    expect(resolveZoneHostIdsOverride('win', classified, null)).toEqual(['local', 'runtime:win-2'])
    expect(resolveZoneHostIdsOverride('win', classified, ['local'])).toEqual(['local'])
    expect(resolveZoneHostIdsOverride('mac', classified, ['local'])).toEqual([])
  })

  it('redirects reveal requests to the matching OS zone or classic view', () => {
    const map = new Map<ExecutionHostId, 'win' | 'mac' | 'other'>([
      ['local', 'win'],
      ['runtime:mac-1' as ExecutionHostId, 'mac'],
      ['ssh:linux-1' as ExecutionHostId, 'other']
    ])

    expect(resolveZoneForWorkspaceHost('all', 'local', map)).toBe('all')
    expect(resolveZoneForWorkspaceHost('teams', 'local', map)).toBe('win')
    expect(resolveZoneForWorkspaceHost('win', 'runtime:mac-1' as ExecutionHostId, map)).toBe('mac')
    expect(resolveZoneForWorkspaceHost('bots', 'ssh:linux-1' as ExecutionHostId, map)).toBe('all')
  })

  it('infers platform bucket from common Win/Mac host names', () => {
    expect(inferPlatformBucketFromLabel('macos')).toBe('mac')
    expect(inferPlatformBucketFromLabel('MacBook-Pro')).toBe('mac')
    expect(inferPlatformBucketFromLabel('win')).toBe('win')
    expect(inferPlatformBucketFromLabel('Windows-Desktop')).toBe('win')
    expect(inferPlatformBucketFromLabel('ubuntu-prod')).toBeNull()
  })

  it('updates and notifies subscribers via sidebar-zone-store', async () => {
    const { getSidebarZoneMode, setSidebarZoneMode } = await import('./sidebar-zone-store')
    setSidebarZoneMode('mac')
    expect(getSidebarZoneMode()).toBe('mac')
    setSidebarZoneMode('win')
    expect(getSidebarZoneMode()).toBe('win')
    setSidebarZoneMode('teams')
    expect(getSidebarZoneMode()).toBe('teams')
  })

  it('partitions AppRail destinations cleanly when 5 leading zone/classic buttons are present', async () => {
    const { partitionAppRail } = await import('../../app-rail/app-rail-overflow')
    expect(partitionAppRail(5, 12, 5)).toEqual({ shownDestinations: 5, more: false })
    expect(partitionAppRail(5, 10, 5)).toEqual({ shownDestinations: 3, more: true })
    expect(partitionAppRail(5, 7, 5)).toEqual({ shownDestinations: 0, more: true })
  })
})
