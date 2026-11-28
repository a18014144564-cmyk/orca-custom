import type * as Chat from '../../../../../../src/shared/native-chat/native-chat-types'
import { deriveNativeChatRowContent } from '../../../../../../src/shared/native-chat/transcript/row-content/native-chat-row-content'
import { MobileNativeChatReasoningRow } from '../message-content/MobileNativeChatReasoningRow'

export function extractVisibleRunReasonings(
  workRun: readonly Chat.NativeChatMessage[] | undefined,
  showToolDetails: boolean,
  showReasoning: boolean
): readonly { message: Chat.NativeChatMessage; markdown: string }[] {
  if (showToolDetails || !showReasoning || !workRun) {
    return []
  }
  const out: { message: Chat.NativeChatMessage; markdown: string }[] = []
  for (const member of workRun) {
    if (member.role !== 'reasoning') {
      continue
    }
    const markdown = deriveNativeChatRowContent(member.blocks).markdown
    if (markdown.trim().length > 0) {
      out.push({ message: member, markdown })
    }
  }
  return out
}

export function MobileHiddenRunReasonings(props: {
  items: readonly { message: Chat.NativeChatMessage; markdown: string }[]
  fontScale: number
  live: boolean
  onToggle?: (key: string) => void
  onLongPress?: () => void
}): React.JSX.Element | null {
  if (props.items.length === 0) {
    return null
  }
  return (
    <>
      {props.items.map(({ message, markdown }) => (
        <MobileNativeChatReasoningRow
          key={message.id}
          message={message}
          markdown={markdown}
          fontScale={props.fontScale}
          live={props.live}
          onToggle={props.onToggle}
          onLongPress={props.onLongPress}
        />
      ))}
    </>
  )
}
