import { structuredAgentSessionStatusPaneKey } from '../../../../src/shared/agent-session/view/structured-agent-session-tab'
import {
  botGroupSessionIds,
  isAnyBotGroupMemberSession,
  REMOTE_BOT_GROUP_MEMBER_SESSION_PREFIX
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
  /** Maps `${placeKey}::${botId}` (or `remote::${botId}`) to the most recently active owning team row key. */
  owningTeamKeyByBot: ReadonlyMap<string, string>
}>

const ORCHESTRATION_MAIL_PROMPT_RE =
  /^\s*(?:────\s*From:|---\s*Orchestration Messages\s*\(|You have \d+ (?:new )?orchestration |An item was added for you:|You are answering in the shared group )/i

export function isOrchestrationDispatchedPrompt(prompt: string | null | undefined): boolean {
  if (!prompt) {
    return false
  }
  return (
    ORCHESTRATION_MAIL_PROMPT_RE.test(prompt) ||
    prompt.includes('[Reply: orca orchestration reply') ||
    prompt.includes('orca bot item show ')
  )
}

export function collectTeamBotFilterContext(botRows: readonly HomeBotRow[]): TeamBotFilterContext {
  const botSessionIds = new Set<string>()
  const teamMemberKeys = new Set<string>()
  const owningTeamKeyByBot = new Map<string, string>()
  const owningTeamActivity = new Map<string, number>()
  const recordOwner = (memberKey: string, teamRowKey: string, activityAt: number) => {
    teamMemberKeys.add(memberKey)
    const prev = owningTeamActivity.get(memberKey) ?? -1
    if (activityAt >= prev) {
      owningTeamActivity.set(memberKey, activityAt)
      owningTeamKeyByBot.set(memberKey, teamRowKey)
    }
  }
  for (const row of botRows) {
    if (row.kind === 'group' && row.group) {
      const rooms = [row.group, ...(row.group.threads ?? [])]
      for (const sessionId of botGroupSessionIds(rooms)) {
        if (sessionId) { botSessionIds.add(sessionId) }
      }
      for (const room of rooms) {
        for (const member of room.members) {
          if (member.botId) {
            recordOwner(`${row.placeKey}::${member.botId}`, row.key, row.activityAt)
          }
        }
      }
      for (const remote of row.group.remoteMembers ?? []) {
        if (remote.botId) {
          recordOwner(`remote::${remote.botId}`, row.key, row.activityAt)
        }
      }
    } else if (row.kind === 'bot' && row.bot?.chatSessionId) {
      botSessionIds.add(row.bot.chatSessionId)
    }
  }
  return { botSessionIds, teamMemberKeys, owningTeamKeyByBot }
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
    agent.paneKey.includes(REMOTE_BOT_GROUP_MEMBER_SESSION_PREFIX) ||
    isAnyBotGroupMemberSession(agent.orcaSessionId)
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

export type TeamMemberDelegatedActivity = Readonly<{
  status: 'attention' | 'working'
  lastActivityAt: number
  memberName: string
}>

/**
 * Finds team member bots currently running a mail/item-dispatched turn (not a human 1-on-1 chat)
 * and rolls that live status back up to their owning Bot Team card so the work stays under the team.
 */
export function collectTeamDelegatedActivity(
  botRows: readonly HomeBotRow[],
  worktreeInfo: Readonly<Record<string, HostWorktreeInfo | undefined>>,
  ctx: TeamBotFilterContext,
  now: number
): ReadonlyMap<string, TeamMemberDelegatedActivity> {
  const byTeam = new Map<string, TeamMemberDelegatedActivity>()
  for (const row of botRows) {
    if (row.kind !== 'bot' || row.offline || !row.bot) { continue }
    const ownerTeamKey =
      ctx.owningTeamKeyByBot.get(`${row.placeKey}::${row.bot.id}`) ??
      ctx.owningTeamKeyByBot.get(`remote::${row.bot.id}`)
    if (!ownerTeamKey) { continue }
    const chatSessionId = row.bot.chatSessionId
    if (!chatSessionId) { continue }
    const chatPaneKey = structuredAgentSessionStatusPaneKey(chatSessionId)
    const info = worktreeInfo[row.pairedHostId]
    const directEntry = info?.agents?.find(
      ({ agent }) =>
        !isAnyBotGroupMemberSession(agent.orcaSessionId) &&
        !agent.paneKey.includes('bot-group-member-') &&
        !agent.paneKey.includes(REMOTE_BOT_GROUP_MEMBER_SESSION_PREFIX) &&
        (agent.paneKey === chatPaneKey || agent.orcaSessionId === chatSessionId)
    )
    if (!directEntry || !isOrchestrationDispatchedPrompt(directEntry.agent.prompt)) { continue }
    const verdict = listedAgentVerdict(directEntry.agent)
    const dot = verdict ? verdict.status : agentDotState(directEntry.agent, now)
    const group = agentStatusGroup(dot)
    if (group !== 'working' && group !== 'needs-you') { continue }
    const status = group === 'needs-you' ? 'attention' : 'working'
    const lastActivityAt = verdict?.sortAt ?? agentRowTimeAt(directEntry.agent)
    const existing = byTeam.get(ownerTeamKey)
    if (
      !existing ||
      (status === 'attention' && existing.status !== 'attention') ||
      (status === existing.status && lastActivityAt > existing.lastActivityAt)
    ) {
      byTeam.set(ownerTeamKey, { status, lastActivityAt, memberName: row.title })
    }
  }
  return byTeam
}

/**
 * Resolve how a Bot or Bot Team row appears in「运行中」:
 * - Bot Team rooms (`kind === 'group'`) always appear when active/recent, including live delegated
 *   mail/item tasks running on their member bots.
 * - Solo Bots that are NOT in any team appear normally.
 * - Bots that belong to a Bot Team ONLY appear when their own 1-on-1 direct chat (`chatSessionId`)
 *   is running a human-initiated turn (never mail/item handoffs or `workingElsewhere` workers).
 */
export function resolveBotRowForRunning(
  row: HomeBotRow,
  worktreeInfo: Readonly<Record<string, HostWorktreeInfo | undefined>>,
  teamMemberKeys: ReadonlySet<string>,
  now: number,
  delegatedByTeam?: ReadonlyMap<string, TeamMemberDelegatedActivity>
): ResolvedBotRunningState | null {
  if (row.kind === 'group') {
    const baseStatus = fallbackBotStatus(row)
    const delegated = row.offline ? undefined : delegatedByTeam?.get(row.key)
    const status =
      delegated && (baseStatus === 'idle' || (delegated.status === 'attention' && baseStatus === 'working'))
        ? delegated.status
        : baseStatus
    const lastActivityAt = Math.max(row.activityAt, delegated?.lastActivityAt ?? 0)
    const subtitle =
      delegated && baseStatus === 'idle'
        ? `${delegated.memberName} 正在执行团队任务`
        : row.preview.trim() || 'Bot 团队'
    return { status, lastActivityAt, subtitle }
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
      agent.paneKey.includes(REMOTE_BOT_GROUP_MEMBER_SESSION_PREFIX) ||
      isAnyBotGroupMemberSession(agent.orcaSessionId) ||
      agent.parentPaneKey != null ||
      listedAgentVerdict(agent)?.childOf != null
    ) {
      return false
    }
    return agent.paneKey === chatPaneKey || agent.orcaSessionId === chatSessionId
  })

  if (directEntry) {
    // Mail/item-dispatched turns on a team member's Home Chat belong to the team, not a 1-on-1 chat.
    if (isOrchestrationDispatchedPrompt(directEntry.agent.prompt)) {
      return null
    }
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
