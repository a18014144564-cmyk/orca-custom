import {
  LOCAL_EXECUTION_HOST_ID,
  type ExecutionHostId
} from '../../../../src/shared/execution-host/execution-host'
import { shellScreenRoute } from '../../mobile-web-shell/routing/shell-screen-route'
import type { BridgeInitRoute } from '../../mobile-web-shell/bridge/protocol/bridge-init-route'
import { workspaceRouteParams } from '../../navigation/workspace-execution-host'

export type FoldableStageTarget =
  | Readonly<{
      kind: 'session'
      hostId: string
      worktreeId: string
      name: string
      paneKey?: string
      executionHost?: ExecutionHostId
    }>
  | Readonly<{
      kind: 'group'
      hostId: string
      groupId: string
      name: string
    }>

export type FoldableAuxMode = 'diff' | 'files' | 'review' | 'session'

export function foldableStageKey(target: FoldableStageTarget): string {
  if (target.kind === 'group') {
    return `group:${target.hostId}:${target.groupId}`
  }
  const hostSuffix =
    target.executionHost && target.executionHost !== LOCAL_EXECUTION_HOST_ID
      ? `:${target.executionHost}`
      : ''
  return `session:${target.hostId}:${target.worktreeId}${hostSuffix}`
}

export function buildFoldableStageRoute(target: FoldableStageTarget): BridgeInitRoute | null {
  if (target.kind === 'group') {
    return shellScreenRoute({
      pathname: `/h/${encodeURIComponent(target.hostId)}/group/${encodeURIComponent(target.groupId)}`
    })
  }
  const params: Record<string, string> = {
    ...(target.name ? { name: target.name } : {}),
    ...(target.paneKey ? { paneKey: target.paneKey } : {}),
    ...(target.executionHost && target.executionHost !== LOCAL_EXECUTION_HOST_ID
      ? workspaceRouteParams(target.executionHost)
      : {})
  }
  return shellScreenRoute({
    pathname: `/h/${encodeURIComponent(target.hostId)}/session/${encodeURIComponent(target.worktreeId)}`,
    ...(Object.keys(params).length > 0 ? { params } : {})
  })
}

export function buildFoldableAuxRoute(
  target: Extract<FoldableStageTarget, { kind: 'session' }>,
  mode: FoldableAuxMode
): BridgeInitRoute | null {
  const host = encodeURIComponent(target.hostId)
  const wt = encodeURIComponent(target.worktreeId)
  const segment =
    mode === 'diff'
      ? 'source-control'
      : mode === 'files'
        ? 'files'
        : mode === 'review'
          ? 'review'
          : 'session'
  const params: Record<string, string> = {
    ...(target.name ? { name: target.name } : {}),
    ...(target.executionHost && target.executionHost !== LOCAL_EXECUTION_HOST_ID
      ? workspaceRouteParams(target.executionHost)
      : {})
  }
  return shellScreenRoute({
    pathname: `/h/${host}/${segment}/${wt}`,
    ...(Object.keys(params).length > 0 ? { params } : {})
  })
}

export function foldableStageHref(target: FoldableStageTarget): string {
  if (target.kind === 'group') {
    return `/h/${encodeURIComponent(target.hostId)}/group/${encodeURIComponent(target.groupId)}`
  }
  const query = new URLSearchParams()
  if (target.name) {
    query.set('name', target.name)
  }
  if (target.paneKey) {
    query.set('paneKey', target.paneKey)
  }
  const qs = query.toString()
  return `/h/${encodeURIComponent(target.hostId)}/session/${encodeURIComponent(target.worktreeId)}${qs ? `?${qs}` : ''}`
}
