import { structuredAgentSessionStatusPaneKey } from '../../../../src/shared/agent-session/view/structured-agent-session-tab'
import {
  botGroupSessionIds,
  isBotGroupMemberSession
} from '../../../../src/shared/bots/bot-group'
import {
  agentStatusGroup,
  isBotOrWorkerWorktree,
  listedAgentVerdict,
  type AgentListRow
} from '../../agents/agent-list-rows'
import { agentDotState, agentRowTimeAt } from '../../worktree/agent-lineage/agent-row-display'
import type { HostWorktreeInfo } from '../../worktree/catalog/home-worktree-info'
import type { HomeBotRow } from '../bots/home-bot-rows'

export type TeamBotFilterContext = Readonly<{
  botSessionIds: ReadonlySet<string>
  teamMemberKeys: ReadonlySet<string>
}>

export function collectTeamBotFilterContext(botRows: readonly HomeBotRow[]): TeamBotFilterContext {
  const botSessionIds = new Set<string>()
  const teamMemberKeys = new Set<string>()
  for (const row of botRows) {
    if (row.kind === 'group' && row.group) {
      const rooms = [row.group, ...(row.group.threads ?? [])]
      for (const sessionId of botGroupSessionIds(rooms)) {
        if (sessionId) { botSessionIds.add(sessionId) }
      }
      for (const room of rooms) {
        for (const member of room.members) {
          if (member.botId) {
            teamMemberKeys.add(`${row.placeKey}::${member.botId}`)
          }
        }
      }
      for (const remote of row.group.remoteMembers ?? []) {
        if (remote.botId) {
          teamMemberKeys.add(`remote::${remote.botId}`)
        }
      }
    } else if (row.kind === 'bot' && row.bot?.chatSessionId) {
      botSessionIds.add(row.bot.chatSessionId)
    }
  }
  return { botSessionIds, teamMemberKeys }
}

export function isDispatchedOrTeamWorkerRow(
  agentRow: AgentListRow,
  info: HostWorktreeInfo | undefined,
  botHomeWorktreeIds: ReadonlySet<string>,
  botSessionIds: ReadonlySet<string>
): boolean {
  const { agent, worktreeId } = agentRow.entry
  if (
    agentRow.depth > 0 ||
    agentRow.entry.bot ||
    agent.parentPaneKey != null ||
    listedAgentVerdict(agent)?.childOf != null ||
    listedAgentVerdict(agent)?.foldedChild === true ||
    agent.paneKey.includes('bot-group-member-') ||
    isBotGroupMemberSession(agent.orcaSessionId)
  ) {
    return true
  }
  if (agent.orcaSessionId && botSessionIds.has(agent.orcaSessionId)) {
    return true
  }
  const colonIdx = agent.paneKey.indexOf(':')
  const paneSession = colonIdx !== -1 ? agent.paneKey.slice(colonIdx + 1) : ''
  if (paneSession && botSessionIds.has(paneSession)) {
    return true
  }
  return isBotOrWorkerWorktree(worktreeId, {
    rows: info?.rows,
    workspaceLineage: info?.workspaceLineage,
    botHomeWorktreeIds,
    excludeBotHomeSelf: true
  })
}

export type ResolvedBotRunningState = Readonly<{
  status: 'attention' | 'working' | 'idle'
  lastActivityAt: number
  subtitle: string
}>

function fallbackBotStatus(row: HomeBotRow): 'attention' | 'working' | 'idle' {
  if (row.offline) {
    return 'idle'
  }
  if (row.needsYou > 0 || row.dot === 'permission') {
    return 'attention'
  }
  if (row.dot === 'working') {
    return 'working'
  }
  return 'idle'
}

/**
 * Resolve how a Bot or Bot Team row appears in「运行中」:
 * - Bot Team rooms (`kind === 'group'`) always appear when active/recent.
 * - Solo Bots that are NOT in any team appear normally.
 * - Bots that belong to a Bot Team ONLY appear when their own 1-on-1 direct chat (`chatSessionId`)
 *   is running or recently active — team-dispatched turns and `workingElsewhere` workers stay under the team.
 */
export function resolveBotRowForRunning(
  row: HomeBotRow,
  worktreeInfo: Readonly<Record<string, HostWorktreeInfo | undefined>>,
  teamMemberKeys: ReadonlySet<string>,
  now: number
): ResolvedBotRunningState | null {
  if (row.kind === 'group') {
    return {
      status: fallbackBotStatus(row),
      lastActivityAt: row.activityAt,
      subtitle: row.preview.trim() || 'Bot 团队'
    }
  }

  const isTeamMember = Boolean(
    row.bot &&
      (teamMemberKeys.has(`${row.placeKey}::${row.bot.id}`) ||
        teamMemberKeys.has(`remote::${row.bot.id}`))
  )
  if (!isTeamMember) {
    return {
      status: fallbackBotStatus(row),
      lastActivityAt: row.activityAt,
      subtitle: row.preview.trim() || '单独 Bot'
    }
  }

  const chatSessionId = row.bot?.chatSessionId
  if (!chatSessionId) {
    return null
  }
  const chatPaneKey = structuredAgentSessionStatusPaneKey(chatSessionId)
  const info = worktreeInfo[row.pairedHostId]
  const hostAgentsList = info?.agents ?? info?.lastSeenAgents
  const directEntry = hostAgentsList?.find(({ agent }) => {
    if (
      agent.paneKey.includes('bot-group-member-') ||
      isBotGroupMemberSession(agent.orcaSessionId) ||
      agent.parentPaneKey != null ||
      listedAgentVerdict(agent)?.childOf != null
    ) {
      return false
    }
    return agent.paneKey === chatPaneKey || agent.orcaSessionId === chatSessionId
  })

  if (directEntry) {
    const verdict = listedAgentVerdict(directEntry.agent)
    const dot = verdict ? verdict.status : agentDotState(directEntry.agent, now)
    const group = row.offline ? 'idle' : agentStatusGroup(dot)
    const status = group === 'needs-you' ? 'attention' : group === 'working' ? 'working' : 'idle'
    const lastActivityAt = verdict?.sortAt ?? agentRowTimeAt(directEntry.agent)
    const isElsewhereLine =
      row.line?.kind === 'workingElsewhere' || row.line?.kind === 'needYouElsewhere'
    const subtitle =
      (!isElsewhereLine && row.preview.trim()) ||
      directEntry.agent.lastAssistantMessage?.trim() ||
      '单独 Bot'
    return { status, lastActivityAt, subtitle }
  }

  // Host sent live agents and this team-member bot has no active/recent 1-on-1 direct chat.
  if (info?.agents !== undefined) {
    return null
  }

  // Offline/kept fallback: never treat team-dispatched elsewhere lines as 1-on-1 direct chat.
  if (
    row.line?.kind === 'activity' ||
    row.line?.kind === 'replying' ||
    row.line?.kind === 'reading'
  ) {
    return {
      status: fallbackBotStatus(row),
      lastActivityAt: row.activityAt,
      subtitle: row.preview.trim() || '单独 Bot'
    }
  }
  return null
}
