import {
  LOCAL_EXECUTION_HOST_ID,
  getExecutionHostLabel,
  type ExecutionHostId
} from '../../../../../shared/execution-host/execution-host'
import type { ExecutionHostHealth } from '../../../../../shared/execution-host/execution-host-health'
import type { SidebarHostOption } from '../worktree-list/controls/sidebar-host-options'
import type { CodexProjectRow } from './sidebar-codex-types'

export type CodexHostGroupInfo = Readonly<{
  hostId: ExecutionHostId
  label: string
  tag: '本地' | 'WSL' | '远程'
  isLocal: boolean
  health: ExecutionHostHealth
}>

export type CodexZoneHostMeta = Readonly<{
  hosts: readonly CodexHostGroupInfo[]
  multiHost: boolean
  canonicalHostById: ReadonlyMap<ExecutionHostId, ExecutionHostId>
  hostInfoById: ReadonlyMap<ExecutionHostId, CodexHostGroupInfo>
}>

export function resolveCodexZoneHostMeta(
  hostOptions: readonly Pick<
    SidebarHostOption,
    'id' | 'label' | 'kind' | 'health' | 'wslDistro' | 'aliasHostIds' | 'mergedIntoHostId'
  >[],
  hostIds: readonly ExecutionHostId[]
): CodexZoneHostMeta {
  const allowed = new Set<ExecutionHostId>(hostIds)
  const canonicalHostById = new Map<ExecutionHostId, ExecutionHostId>()
  const hostInfoById = new Map<ExecutionHostId, CodexHostGroupInfo>()
  const matched: CodexHostGroupInfo[] = []
  const seenPrimary = new Set<ExecutionHostId>()

  for (const option of hostOptions) {
    if (option.mergedIntoHostId) {
      continue
    }
    const allIds: ExecutionHostId[] = [option.id, ...(option.aliasHostIds ?? [])]
    if (!allIds.some((id) => allowed.has(id))) {
      continue
    }
    if (seenPrimary.has(option.id)) {
      continue
    }
    seenPrimary.add(option.id)

    const isLocal = option.kind === 'local' || option.id === LOCAL_EXECUTION_HOST_ID
    const tag: CodexHostGroupInfo['tag'] = isLocal ? '本地' : option.wslDistro ? 'WSL' : '远程'
    const info: CodexHostGroupInfo = {
      hostId: option.id,
      label: option.label.trim() || getExecutionHostLabel(option.id),
      tag,
      isLocal,
      health: option.health
    }
    matched.push(info)
    for (const id of allIds) {
      canonicalHostById.set(id, option.id)
      hostInfoById.set(id, info)
    }
  }

  for (const id of hostIds) {
    if (canonicalHostById.has(id)) {
      continue
    }
    const isLocal = id === LOCAL_EXECUTION_HOST_ID
    const info: CodexHostGroupInfo = {
      hostId: id,
      label: getExecutionHostLabel(id),
      tag: isLocal ? '本地' : '远程',
      isLocal,
      health: isLocal ? 'local' : 'disconnected'
    }
    matched.push(info)
    canonicalHostById.set(id, id)
    hostInfoById.set(id, info)
  }

  matched.sort((a, b) => Number(b.isLocal) - Number(a.isLocal))

  return {
    hosts: matched,
    multiHost: matched.length > 1,
    canonicalHostById,
    hostInfoById
  }
}

export type CodexProjectHostSection = Readonly<{
  host: CodexHostGroupInfo
  projects: readonly CodexProjectRow[]
}>

export function groupCodexProjectsByHost(
  projects: readonly CodexProjectRow[],
  hostMeta: CodexZoneHostMeta
): CodexProjectHostSection[] {
  const buckets = new Map<ExecutionHostId, CodexProjectRow[]>()
  for (const project of projects) {
    const canonical =
      hostMeta.canonicalHostById.get(project.hostId) ?? project.hostId
    const list = buckets.get(canonical)
    if (list) {
      list.push(project)
    } else {
      buckets.set(canonical, [project])
    }
  }

  const sections: CodexProjectHostSection[] = []
  for (const host of hostMeta.hosts) {
    const list = buckets.get(host.hostId)
    if (list && list.length > 0) {
      sections.push({ host, projects: list })
      buckets.delete(host.hostId)
    }
  }
  for (const [hostId, list] of buckets) {
    if (list.length === 0) {
      continue
    }
    const isLocal = hostId === LOCAL_EXECUTION_HOST_ID
    sections.push({
      host: hostMeta.hostInfoById.get(hostId) ?? {
        hostId,
        label: getExecutionHostLabel(hostId),
        tag: isLocal ? '本地' : '远程',
        isLocal,
        health: isLocal ? 'local' : 'disconnected'
      },
      projects: list
    })
  }
  return sections
}
