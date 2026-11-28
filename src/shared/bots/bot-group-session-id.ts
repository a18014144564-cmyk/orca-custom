/** A group member's own native session, as opposed to Home or any other chat. */
export function isBotGroupMemberSession(sessionId: string | null | undefined): sessionId is string {
  return sessionId?.startsWith('bot-group-member-') === true
}

/** A remote computer's isolated session for answering a Bot Team hosted on another computer. */
export const REMOTE_BOT_GROUP_MEMBER_SESSION_PREFIX = 'bot-remote-group-member-'

export function isRemoteBotGroupMemberSession(
  sessionId: string | null | undefined
): sessionId is string {
  return sessionId?.startsWith(REMOTE_BOT_GROUP_MEMBER_SESSION_PREFIX) === true
}

/** Either a local group member session or a remote-group isolated session; hidden from private 1-on-1 bot chats. */
export function isAnyBotGroupMemberSession(
  sessionId: string | null | undefined
): sessionId is string {
  return isBotGroupMemberSession(sessionId) || isRemoteBotGroupMemberSession(sessionId)
}
