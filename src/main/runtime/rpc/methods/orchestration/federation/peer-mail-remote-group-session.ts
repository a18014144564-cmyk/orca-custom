import { createHash } from 'node:crypto'
import type { z } from 'zod'
import { botOfAddress, parseBotAddress } from '../../../../../../shared/bot-roster'
import { OWNER_ACTS_FOR } from '../../../../../../shared/bots/bot-acts-for'
import { REMOTE_BOT_GROUP_MEMBER_SESSION_PREFIX } from '../../../../../../shared/bots/bot-group'
import { runKeyedSerializedOperation } from '../../../../../../shared/concurrency/keyed-serialized-operations'
import type { PeerMailDeliverParams } from '../../../../../../shared/rpc-contract/orchestration/orchestration-peer-mail-params'
import { folderWorkspaceKey } from '../../../../../../shared/workspace/identity/workspace-scope'
import { requireStructuredHost, startBotSession } from '../../../../../bots/bot-chat-session'
import type { OrcaRuntimeService } from '../../../../orca-runtime'
import { botChatAddress } from '../messaging/bot-chat-address'

const REMOTE_GROUP_BODY_PREFIX = 'You are answering in the shared group '
const createQueues = new Map<string, Promise<void>>()

export function isRemoteBotGroupAsk(params: z.infer<typeof PeerMailDeliverParams>): boolean {
  return (
    params.type === 'question' &&
    params.chat !== undefined &&
    params.to.startsWith('bot:') &&
    typeof params.body === 'string' &&
    params.body.startsWith(REMOTE_GROUP_BODY_PREFIX)
  )
}

export function remoteBotGroupMemberSessionId(
  peerFingerprint: string,
  conversationId: string,
  botId: string,
  agent: string
): string {
  const digest = createHash('sha256')
    .update(`${peerFingerprint}\u0000${conversationId}\u0000${botId}\u0000${agent}`)
    .digest('hex')
    .slice(0, 32)
  return `${REMOTE_BOT_GROUP_MEMBER_SESSION_PREFIX}${digest}`
}

/**
 * Remote Bot Team questions arrive addressed to the bot's joined Home Chat (`params.chat`), which
 * previously mixed group Q&A directly into the bot's private 1-on-1 chat. Validate the original
 * bot + chat ownership first, then route the turn into a dedicated background session per
 * (peer, group conversation, bot, agent) so private chat stays completely clean.
 */
export async function resolveRemoteBotGroupChat(
  runtime: OrcaRuntimeService,
  params: z.infer<typeof PeerMailDeliverParams>,
  peerFingerprint: string
): Promise<string | undefined> {
  if (!isRemoteBotGroupAsk(params) || !params.chat) {
    return params.chat
  }
  await botChatAddress(runtime, params.to, params.chat)
  const botNameOrId = parseBotAddress(params.to)
  const bot = botNameOrId ? botOfAddress(runtime.bots.list(), botNameOrId) : null
  if (!bot) {
    return params.chat
  }
  const sessionId = remoteBotGroupMemberSessionId(
    peerFingerprint,
    params.conversationId,
    bot.id,
    bot.agent
  )
  const homeWorkspaceId = folderWorkspaceKey(bot.folderWorkspaceId)
  return runKeyedSerializedOperation(createQueues, sessionId, async () => {
    const host = await requireStructuredHost(runtime)
    const existing = host.deps.store.getConversation(sessionId)
    if (
      existing &&
      existing.provider === bot.agent &&
      existing.location.workspaceId === homeWorkspaceId
    ) {
      return sessionId
    }
    await startBotSession(runtime, bot, {
      sessionId,
      background: true,
      actsFor: { actsFor: [...OWNER_ACTS_FOR] }
    })
    const title = params.sender?.name?.trim() || params.senderLabel.trim()
    if (title) {
      await host
        .setUserConversationName(sessionId, title, 'rename')
        .catch((error: unknown) =>
          console.warn('[bots] could not name remote group member session', error)
        )
    }
    return sessionId
  })
}
