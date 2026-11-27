import { parseExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import { openDesktopStructuredSession } from '@/lib/agent-session/open/activate-ai-vault-structured-session'
import type { CodexRecentRow } from './sidebar-codex-types'

export function reopenArchivedCodexThread(item: CodexRecentRow): boolean {
  if (!item.archivedSessionId) {
    return false
  }
  const parsedHost = parseExecutionHostId(item.hostId)
  const target =
    parsedHost?.kind === 'runtime'
      ? ({ kind: 'environment', environmentId: parsedHost.environmentId } as const)
      : ({ kind: 'local' } as const)
  void openDesktopStructuredSession(
    {
      kind: 'history',
      structuredSession: { sessionId: item.archivedSessionId, workspaceId: item.worktreeId },
      agent: item.archivedAgentType ?? undefined
    },
    { target }
  )
  return true
}
