import { Brain, Wrench } from 'lucide-react'
import {
  toggleDesktopChatReasoning,
  toggleDesktopChatToolDetails,
  useDesktopChatDisplayPrefs
} from './chat-display-prefs'

export function ChatDisplayToggleBar(): React.JSX.Element {
  const { showReasoning, showToolDetails } = useDesktopChatDisplayPrefs()
  return (
    <div className="pointer-events-auto flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggleDesktopChatReasoning}
        title={showReasoning ? '隐藏过程思考' : '显示过程思考'}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
          showReasoning
            ? 'border-border/80 bg-muted/70 text-foreground'
            : 'border-border/40 bg-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        <Brain className="h-3 w-3" />
        <span>思考 {showReasoning ? '开' : '关'}</span>
      </button>
      <button
        type="button"
        onClick={toggleDesktopChatToolDetails}
        title={showToolDetails ? '隐藏工具调用详情' : '显示工具调用详情'}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
          showToolDetails
            ? 'border-border/80 bg-muted/70 text-foreground'
            : 'border-border/40 bg-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        <Wrench className="h-3 w-3" />
        <span>工具 {showToolDetails ? '开' : '关'}</span>
      </button>
    </div>
  )
}
