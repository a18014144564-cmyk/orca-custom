import { parseExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import {
  activateAiVaultStructuredSession,
  openDesktopStructuredSession
} from '@/lib/agent-session/open/activate-ai-vault-structured-session'
import { useAppStore } from '@/store'
import { extractStructuredSessionIdFromKey } from './sidebar-codex-thread-archive'
import type { CodexRecentRow } from './sidebar-codex-types'

async function tryReopenFromAiVault(
  item: CodexRecentRow,
  sessionId: string | null,
  target: { readonly kind: 'local' } | { readonly kind: 'environment'; readonly environmentId: string }
): Promise<boolean> {
  if (typeof window === 'undefined' || !window.api?.aiVault?.listSessions) {
    return false
  }
  const knownWorktree = useAppStore.getState().getKnownWorktreeById?.(item.worktreeId, item.hostId)
  const scopePaths = knownWorktree?.path ? [knownWorktree.path] : []
  try {
    const listed = await window.api.aiVault.listSessions({
      includeAntigravityIdeSessions: true,
      limit: 60,
      scopePaths,
      ...(scopePaths.length > 0 ? { scopeOnly: true } : {}),
      executionHostScope: item.hostId,
      requestToken: `codex-reopen:${Date.now()}`
    })
    if (listed.unchanged || !Array.isArray(listed.sessions)) {
      return false
    }
    const normalizedTitle = item.title.trim().toLowerCase()
    const matched = listed.sessions.find((session) => {
      if (!session.structuredSession) {
        return false
      }
      if (sessionId && session.structuredSession.sessionId === sessionId) {
        return true
      }
      if (session.structuredSession.workspaceId !== item.worktreeId) {
        return false
      }
      return normalizedTitle.length > 0 && session.title.trim().toLowerCase() === normalizedTitle
    })
    if (!matched) {
      return false
    }
    return await activateAiVaultStructuredSession(matched, undefined, target)
  } catch {
    return false
  }
}

export async function reopenArchivedCodexThread(item: CodexRecentRow): Promise<boolean> {
  const sessionId = item.archivedSessionId ?? extractStructuredSessionIdFromKey(item.key)
  const parsedHost = parseExecutionHostId(item.hostId)
  const target =
    parsedHost?.kind === 'runtime'
      ? ({ kind: 'environment', environmentId: parsedHost.environmentId } as const)
      : ({ kind: 'local' } as const)

  if (sessionId) {
    try {
      const result = await openDesktopStructuredSession(
        {
          kind: 'history',
          structuredSession: { sessionId, workspaceId: item.worktreeId },
          agent: item.archivedAgentType ?? undefined
        },
        { target }
      )
      if (result.kind === 'opened') {
        return true
      }
    } catch {
      // Fall through to AI Vault lookup below.
    }
  }

  return tryReopenFromAiVault(item, sessionId, target)
}
