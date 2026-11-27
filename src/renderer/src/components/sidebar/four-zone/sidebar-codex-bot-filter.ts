import type { Bot } from '../../../../../shared/bot-types'
import { botGroupSessionIds, isBotGroupMemberSession, type BotGroup } from '../../../../../shared/bots/bot-group'
import {
  structuredAgentSessionTabId
} from '../../../../../shared/agent-session/view/structured-agent-session-projection'
import { getWorktreeHostIdentity } from '../../../../../shared/worktree/host-qualified-identity'
import type { Worktree } from '../../../../../shared/worktree/types'
import type { WorktreeLineage } from '../../../../../shared/worktree/lineage-types'
import type { ExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import type { AgentPaneThread } from '@/components/activity/threads/activity-thread-types'

const STRUCTURED_TAB_PREFIX = 'structured-agent-session-'

export function collectExcludedBotSessionIds(
  bots: readonly Pick<Bot, 'chatSessionId'>[],
  botGroups: readonly Pick<BotGroup, 'members' | 'formerSessionIds' | 'threads'>[]
): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const bot of bots) {
    if (bot.chatSessionId) {
      ids.add(bot.chatSessionId)
    }
  }
  for (const group of botGroups) {
    const rooms = [group, ...(group.threads ?? [])]
    for (const sessionId of botGroupSessionIds(rooms)) {
      if (sessionId) {
        ids.add(sessionId)
      }
    }
  }
  return ids
}

function extractSessionIdFromTabOrPane(tabId: string | undefined, paneKey?: string): string | null {
  if (tabId && tabId.startsWith(STRUCTURED_TAB_PREFIX)) {
    return tabId.slice(STRUCTURED_TAB_PREFIX.length)
  }
  if (paneKey) {
    const colonIndex = paneKey.indexOf(':')
    if (colonIndex !== -1 && colonIndex < paneKey.length - 1) {
      return paneKey.slice(colonIndex + 1)
    }
  }
  return null
}

export function isExcludedBotSessionTabId(
  tabId: string | undefined,
  excludedBotSessionIds: ReadonlySet<string>
): boolean {
  if (!tabId) {
    return false
  }
  if (tabId.includes('bot-group-member-')) {
    return true
  }
  const sessionId = extractSessionIdFromTabOrPane(tabId)
  if (sessionId && (isBotGroupMemberSession(sessionId) || excludedBotSessionIds.has(sessionId))) {
    return true
  }
  for (const id of excludedBotSessionIds) {
    if (tabId === id || tabId === structuredAgentSessionTabId(id)) {
      return true
    }
  }
  return false
}

export function hasThreadOrchestrationContext(thread: AgentPaneThread): boolean {
  if (
    thread.currentAgentEntry?.orchestration ||
    thread.paneEntry?.orchestration ||
    thread.latestEvent?.entry.orchestration
  ) {
    return true
  }
  return thread.events.some((event) => Boolean(event.entry.orchestration))
}

export function isBotOrOrchestrationWorktree(
  worktree: Pick<Worktree, 'id' | 'hostId'>,
  resolvedHostId: ExecutionHostId,
  botOwnedWorktreeIdentities: ReadonlySet<string>,
  worktreeLineageById?: Readonly<Record<string, WorktreeLineage | undefined>>
): boolean {
  if (
    botOwnedWorktreeIdentities.has(getWorktreeHostIdentity({ ...worktree, hostId: resolvedHostId }))
  ) {
    return true
  }
  const lineage = worktreeLineageById?.[worktree.id]
  if (!lineage) {
    return false
  }
  return (
    lineage.origin === 'orchestration' ||
    lineage.capture?.source === 'bot-hand-over' ||
    Boolean(lineage.orchestrationRunId)
  )
}

export function isExcludedBotOrTeamThread(
  thread: AgentPaneThread,
  resolvedHostId: ExecutionHostId,
  ctx: {
    botHomeWorktreeIds: ReadonlySet<string>
    botOwnedWorktreeIdentities: ReadonlySet<string>
    excludedBotSessionIds: ReadonlySet<string>
    worktreeLineageById?: Readonly<Record<string, WorktreeLineage | undefined>>
  }
): boolean {
  if (ctx.botHomeWorktreeIds.has(thread.worktree.id)) {
    return true
  }
  if (
    isBotOrOrchestrationWorktree(
      thread.worktree,
      resolvedHostId,
      ctx.botOwnedWorktreeIdentities,
      ctx.worktreeLineageById
    )
  ) {
    return true
  }
  if (
    thread.paneKey.includes('bot-group-member-') ||
    isExcludedBotSessionTabId(thread.tab?.id, ctx.excludedBotSessionIds)
  ) {
    return true
  }
  const sessionId = extractSessionIdFromTabOrPane(thread.tab?.id, thread.paneKey)
  if (
    sessionId &&
    (isBotGroupMemberSession(sessionId) || ctx.excludedBotSessionIds.has(sessionId))
  ) {
    return true
  }
  if (hasThreadOrchestrationContext(thread)) {
    return true
  }
  return false
}
