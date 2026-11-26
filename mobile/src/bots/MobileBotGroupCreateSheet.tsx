import { useRef, useState } from 'react'
import { Platform } from 'react-native'
import { FileText, Globe, MessageSquare, SquareTerminal } from 'lucide-react-native'
import { BottomDrawer } from '../components/bottom-drawer/BottomDrawer'
import { TextInputModal } from '../components/sheets/TextInputModal'
import { LIST_LEADING_INSET, ListGroup, ListRow, SectionHeader } from '../components/list/ListGroup'
import { SheetHeader } from '../components/nav-bar/SheetHeader'
import { useMobileTranslation } from '../i18n/use-mobile-translation'
import { colors } from '../theme/mobile-theme'
import { useMobileColorScheme } from '../theme/use-mobile-color-scheme'
import type { RpcClient } from '../transport/rpc/rpc-client-contract'
import { randomV4Uuid } from '../platform/random-v4-uuid'
import { normalizeBrowserUrl } from '../browser/pane-view/browser-url'
import { sessionBrowserTabCreate } from '../browser/tab-navigation/mobile-session-browser-operations'
import { sessionMarkdownNoteCreate } from '../files/session-documents/mobile-markdown-tab-operations'
import { sourceFileOpenRun } from '../files/session-documents/mobile-source-file-open-operations'
import { captureMobileFileMutationOwnership } from '../files/mutation-ownership/mobile-file-mutation-ownership'
import { isFileExistsErrorMessage } from '../files/mutation-ownership/file-exists-error'
import { requestMobileSessionTerminalCreate } from '../terminal/session/creation/mobile-session-terminal-create-request'
import { useMobileWindowsShellChoices } from '../terminal/session/creation/mobile-windows-shell-choices'
import { interpretOrThrowRefusalMessage } from '../transport/rpc/rpc-refusal-message'
import {
  WINDOWS_GIT_BASH_SHELL,
  type BuiltInWindowsTerminalShell
} from '../../../src/shared/shell/launch/windows-terminal-shell'

function windowsShellLabel(
  shell: BuiltInWindowsTerminalShell,
  t: ReturnType<typeof useMobileTranslation>
): string {
  switch (shell) {
    case 'powershell.exe':
      return t('session.sheets.shellPowerShell', 'PowerShell')
    case 'cmd.exe':
      return t('session.sheets.shellCmd', 'CMD Prompt')
    case WINDOWS_GIT_BASH_SHELL:
      return t('session.sheets.shellGitBash', 'Git Bash')
    case 'wsl.exe':
      return t('session.sheets.shellWsl', 'WSL')
  }
}

/** Bot group "+" sheet: lets the user start a new topic OR open a terminal, browser, or markdown note. */
export function MobileBotGroupCreateSheet({
  visible,
  client,
  worktreeId,
  groupName,
  latestUrl,
  disabled,
  onClose,
  onNewThread,
  onOpenWorkspaceSession,
  onWorkspaceTabsChanged,
  onError
}: {
  visible: boolean
  client: RpcClient
  worktreeId: string
  groupName: string
  latestUrl: string | null
  disabled: boolean
  onClose: () => void
  onNewThread: () => void
  onOpenWorkspaceSession: () => void
  onWorkspaceTabsChanged: () => void
  onError: (message: string) => void
}) {
  useMobileColorScheme()
  const t = useMobileTranslation()
  const afterCloseRef = useRef<(() => void) | null>(null)
  const [browserModalOpen, setBrowserModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const terminalShells = useMobileWindowsShellChoices({
    client,
    sheetOpen: visible,
    worktreeId
  })

  const closeThen = (action: () => void) => {
    afterCloseRef.current = action
    onClose()
  }

  const closeAndRun = (action: () => void) => {
    onClose()
    action()
  }

  const createBrowser = async (rawUrl: string): Promise<boolean> => {
    if (busy) {
      return false
    }
    const url = normalizeBrowserUrl(rawUrl)
    if (!url) {
      onError(t('session.useContentCreateActions.invalidUrl', 'Enter a valid URL'))
      return false
    }
    setBusy(true)
    try {
      const response = await sessionBrowserTabCreate.request(
        client,
        {
          worktree: `id:${worktreeId}`,
          url,
          activate: true
        },
        { timeoutMs: 30_000 }
      )
      interpretOrThrowRefusalMessage(() => sessionBrowserTabCreate.interpret(response), '')
      onWorkspaceTabsChanged()
      onOpenWorkspaceSession()
      return true
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error))
      return false
    } finally {
      setBusy(false)
    }
  }

  const createTerminal = async (shell?: BuiltInWindowsTerminalShell) => {
    if (busy) {
      return
    }
    setBusy(true)
    try {
      const response = await requestMobileSessionTerminalCreate({
        client,
        worktreeId,
        clientMutationId: randomV4Uuid(),
        shell
      })
      if (!response.ok) {
        throw new Error(response.error.message || '创建终端失败')
      }
      onWorkspaceTabsChanged()
      onOpenWorkspaceSession()
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const createMarkdownNote = async () => {
    if (busy) {
      return
    }
    setBusy(true)
    try {
      const worktree = `id:${worktreeId}`
      const mutationOwnership = await captureMobileFileMutationOwnership(client, worktree)
      for (let attempt = 1; attempt <= 100; attempt += 1) {
        const relativePath = attempt === 1 ? 'untitled.md' : `untitled-${attempt}.md`
        const createResponse = await sessionMarkdownNoteCreate.request(
          client,
          { worktree, relativePath, ...mutationOwnership },
          { timeoutMs: 15_000 }
        )
        if (!createResponse.ok) {
          if (isFileExistsErrorMessage(createResponse.error.message) && attempt < 100) {
            continue
          }
          throw new Error(createResponse.error.message || '创建 Markdown 笔记失败')
        }
        const openResponse = await sourceFileOpenRun.request(
          client,
          { worktree, relativePath },
          { timeoutMs: 15_000 }
        )
        interpretOrThrowRefusalMessage(() => sourceFileOpenRun.interpret(openResponse), '')
        onWorkspaceTabsChanged()
        onOpenWorkspaceSession()
        return
      }
      throw new Error('无法创建新的 Markdown 笔记')
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const iconColor = colors.textSecondary
  const newThreadLabel = t('bots.groups.newThreadTab', 'New thread')

  return (
    <>
      <BottomDrawer
        visible={visible}
        onClose={onClose}
        onAfterClose={() => {
          const run = afterCloseRef.current
          afterCloseRef.current = null
          run?.()
        }}
        dragContentToDismiss
      >
        <SheetHeader title={t('session.sheets.newTab', 'New Tab')} subtitle={groupName} onClose={onClose} />
        <SectionHeader title="团队话题" first />
        <ListGroup separatorInset={LIST_LEADING_INSET}>
          <ListRow
            key="new-thread"
            title={newThreadLabel}
            subtitle={t('bots.groups.newThreadHint', 'starts fresh')}
            leading={<MessageSquare size={16} color={iconColor} />}
            disabled={disabled || busy}
            onPress={() => closeAndRun(onNewThread)}
          />
        </ListGroup>
        <SectionHeader title={t('session.sheets.more', 'More')} />
        <ListGroup separatorInset={LIST_LEADING_INSET}>
          {terminalShells.length > 0 ? (
            terminalShells.map((shell) => (
              <ListRow
                key={shell}
                title={t('session.sheets.terminalWithShell', 'Terminal: {{shell}}', {
                  shell: windowsShellLabel(shell, t)
                })}
                leading={<SquareTerminal size={16} color={iconColor} />}
                disabled={disabled || busy}
                onPress={() => closeAndRun(() => void createTerminal(shell))}
              />
            ))
          ) : (
            <ListRow
              key="terminal"
              title={t('session.sheets.terminal', 'Terminal')}
              leading={<SquareTerminal size={16} color={iconColor} />}
              disabled={disabled || busy}
              onPress={() => closeAndRun(() => void createTerminal())}
            />
          )}
          <ListRow
            key="browser"
            title={t('session.sheets.browser', 'Browser')}
            subtitle={latestUrl ?? undefined}
            leading={<Globe size={16} color={iconColor} />}
            navigates
            disabled={disabled || busy}
            onPress={() => closeThen(() => setBrowserModalOpen(true))}
          />
          <ListRow
            key="markdown"
            title={t('session.sheets.markdownNote', 'Markdown Note')}
            leading={<FileText size={16} color={iconColor} />}
            disabled={disabled || busy}
            onPress={() => closeAndRun(() => void createMarkdownNote())}
          />
        </ListGroup>
      </BottomDrawer>

      <TextInputModal
        visible={browserModalOpen}
        title={t('session.sheets.newBrowser', 'New Browser')}
        message={t('session.sheets.urlPrompt', 'Enter a URL, or leave blank for a new tab.')}
        defaultValue={latestUrl ?? ''}
        placeholder="http://127.0.0.1:8899"
        submitLabel={t('common.open', 'Open')}
        allowEmpty
        selectTextOnFocus
        keyboardType={Platform.OS === 'android' ? 'default' : 'url'}
        onSubmit={(value) => {
          void createBrowser(value).then((created) => {
            if (created) {
              setBrowserModalOpen(false)
            }
          })
        }}
        onCancel={() => setBrowserModalOpen(false)}
      />
    </>
  )
}
