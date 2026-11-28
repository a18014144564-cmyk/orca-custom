import { describe, expect, it } from 'vitest'
import {
  isAnyBotGroupMemberSession,
  isBotGroupMemberSession,
  isRemoteBotGroupMemberSession
} from '../../../../../../shared/bots/bot-group'
import { botOwnChatTree } from '../../../../../../shared/bots/bot-chat-tree'
import { selectBotRowLine } from '../../../../../../shared/bots/bot-row-line'
import { isAgentSessionId } from '../../../../../../shared/agent-session/lifecycle/agent-session-record'
import {
  isRemoteBotGroupAsk,
  remoteBotGroupMemberSessionId
} from './peer-mail-remote-group-session'

describe('peer-mail-remote-group-session', () => {
  it('derives deterministic valid Orca session IDs per (peer, conversation, bot, agent) isolated from local group sessions', () => {
    const idA = remoteBotGroupMemberSessionId('fp-win', 'peerconv_1', 'bot-mac-1', 'claude')
    const idARepeat = remoteBotGroupMemberSessionId('fp-win', 'peerconv_1', 'bot-mac-1', 'claude')
    const idOtherTeam = remoteBotGroupMemberSessionId('fp-win', 'peerconv_2', 'bot-mac-1', 'claude')
    const idOtherAgent = remoteBotGroupMemberSessionId('fp-win', 'peerconv_1', 'bot-mac-1', 'codex')

    expect(idA).toBe(idARepeat)
    expect(idA).not.toBe(idOtherTeam)
    expect(idA).not.toBe(idOtherAgent)
    expect(isAgentSessionId(idA)).toBe(true)
    expect(isRemoteBotGroupMemberSession(idA)).toBe(true)
    expect(isAnyBotGroupMemberSession(idA)).toBe(true)
    // Must not trigger local BotGroupStore checks that require a local group record.
    expect(isBotGroupMemberSession(idA)).toBe(false)
  })

  it('identifies remote Bot Team group asks without catching ordinary 1-on-1 peer mail', () => {
    const base = {
      conversationId: 'peerconv_1',
      messageId: 'msg_1',
      to: 'bot:bot-mac-1',
      senderLabel: '风神开发团队 on DESKTOP-WIN',
      subject: 'In 风神开发团队: 帮我查一下',
      chat: 'home-chat-uuid',
      type: 'question' as const
    }

    expect(
      isRemoteBotGroupAsk({
        ...base,
        body: 'You are answering in the shared group "风神开发团队" as "Mac 助手"; the group lives on another computer.'
      })
    ).toBe(true)

    expect(
      isRemoteBotGroupAsk({
        ...base,
        body: 'Hey Mac bot, can you review this PR directly?'
      })
    ).toBe(false)
  })

  it('hides remote bot group sessions from botOwnChatTree and private bot row status lines', () => {
    const remoteSessionId = remoteBotGroupMemberSessionId(
      'fp-win',
      'peerconv_1',
      'bot-mac-1',
      'claude'
    )
    const tree = botOwnChatTree({
      chats: [
        { chatId: 'home-chat-1' },
        { chatId: remoteSessionId },
        { chatId: 'bot-group-member-local-1' }
      ] as unknown as Parameters<typeof botOwnChatTree>[0]['chats'],
      workspaceChats: {
        'wt-home': 'home-chat-1',
        'wt-remote-worker': remoteSessionId
      }
    })
    expect(tree.chats.map((c) => c.chatId)).toEqual(['home-chat-1'])
    expect(tree.workspaceChats).toEqual({ 'wt-home': 'home-chat-1' })

    const line = selectBotRowLine(
      {
        paused: false,
        chatSessionId: 'home-chat-1',
        links: [],
        waits: [],
        now: 10_000,
        rows: [
          {
            paneKey: `structured-agent-session-${remoteSessionId}:${remoteSessionId}`,
            live: true,
            needsYou: false,
            updatedAt: 9_000
          }
        ]
      },
      {
        paneKey: (r) => r.paneKey,
        subagent: () => false,
        live: (r) => r.live,
        needsYou: (r) => r.needsYou,
        updatedAt: (r) => r.updatedAt,
        status: () => 'Answering remote group',
        at: (r) => r.updatedAt
      }
    )
    expect(line).toBeNull()
  })
})
