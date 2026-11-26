import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import {
  Check,
  FileText,
  Globe,
  MessageSquare,
  Plus,
  SquareTerminal,
  Trash2,
  Users,
  X
} from 'lucide-react-native'
import { BottomDrawer } from '../components/bottom-drawer/BottomDrawer'
import { ConfirmModal } from '../components/sheets/ConfirmModal'
import { LIST_LEADING_INSET, ListGroup, ListRow, SectionHeader } from '../components/list/ListGroup'
import { SheetHeader } from '../components/nav-bar/SheetHeader'
import { useMobileTranslation } from '../i18n/use-mobile-translation'
import { sessionTabBarStyles as styles } from '../session/tabs/MobileSessionTabBar'
import { sessionTabsListRead } from '../session/tabs/mobile-session-tab-read-operations'
import {
  sessionTabActivate,
  sessionTabClose
} from '../session/tabs/mobile-session-tab-write-operations'
import { useOpenMobileSession } from '../session/use-open-mobile-session'
import { colors, radii } from '../theme/mobile-theme'
import { themedStyleSheet } from '../theme/themed-styles'
import { useMobileColorScheme } from '../theme/use-mobile-color-scheme'
import type { RpcClient } from '../transport/rpc/rpc-client-contract'
import type { BotGroup } from '../../../src/shared/bots/bot-group'
import { botHomeWorktreeId } from './host-bots-read'
import {
  filterVisibleBotGroupThreads,
  hideGroupThread,
  loadHiddenGroupThreads,
  parseGroupWorkspaceTabs,
  type GroupWorkspaceTab
} from './bot-group-hidden-threads'
import { MobileBotGroupCreateSheet } from './MobileBotGroupCreateSheet'

/** A group's rooms and workspace tabs (browser/terminal/notes): switch/delete topics and create new ones. */
export function MobileBotGroupRoomBar({
  client,
  hostId,
  group,
  threadId,
  latestUrl,
  connected,
  createDisabled,
  onOpenRoom,
  onNewThread,
  onError
}: {
  client: RpcClient
  hostId: string
  group: Pick<BotGroup, 'id' | 'name' | 'threads' | 'folderWorkspaceId'>
  threadId: string | undefined
  latestUrl: string | null
  connected: boolean
  createDisabled: boolean
  onOpenRoom: (threadId: string | undefined) => void
  onNewThread: () => void
  onError: (message: string) => void
}) {
  useMobileColorScheme()
  const t = useMobileTranslation()
  const openMobileSession = useOpenMobileSession()
  const [listing, setListing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [hiddenThreadIds, setHiddenThreadIds] = useState<ReadonlySet<string>>(() => new Set())
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null)
  const [workspaceTabs, setWorkspaceTabs] = useState<readonly GroupWorkspaceTab[]>([])
  const afterListingCloseRef = useRef<(() => void) | null>(null)

  const worktreeId = botHomeWorktreeId(group)

  useEffect(() => {
    let active = true
    void loadHiddenGroupThreads(hostId, group.id).then((ids) => {
      if (active) {
        setHiddenThreadIds(ids)
      }
    })
    return () => {
      active = false
    }
  }, [group.id, hostId])

  const refreshWorkspaceTabs = useCallback(async () => {
    if (!connected) {
      return
    }
    try {
      const response = await sessionTabsListRead.request(
        client,
        { worktree: `id:${worktreeId}` },
        { timeoutMs: 8_000 }
      )
      const parsed = sessionTabsListRead.interpret(response)
      setWorkspaceTabs(parseGroupWorkspaceTabs(parsed))
    } catch {
      // Keep the last known workspace tabs if the read fails.
    }
  }, [client, connected, worktreeId])

  useEffect(() => {
    if (connected) {
      void refreshWorkspaceTabs()
    }
  }, [connected, refreshWorkspaceTabs])

  useEffect(() => {
    if (listing && connected) {
      void refreshWorkspaceTabs()
    }
  }, [connected, listing, refreshWorkspaceTabs])

  const openWorkspaceSession = useCallback(() => {
    openMobileSession({
      hostId,
      worktreeId,
      name: group.name,
      standalone: true
    })
  }, [group.name, hostId, openMobileSession, worktreeId])

  const openWorkspaceTab = useCallback(
    async (tab: GroupWorkspaceTab) => {
      setListing(false)
      try {
        await sessionTabActivate.request(client, {
          worktree: `id:${worktreeId}`,
          tabId: tab.id
        })
      } catch {
        // Still open the session view even if activate is ignored by older hosts.
      }
      openWorkspaceSession()
    },
    [client, openWorkspaceSession, worktreeId]
  )

  const closeWorkspaceTab = useCallback(
    async (tab: GroupWorkspaceTab) => {
      try {
        await sessionTabClose.request(client, {
          worktree: `id:${worktreeId}`,
          tabId: tab.id
        })
        setWorkspaceTabs((prev) => prev.filter((item) => item.id !== tab.id))
      } catch (error) {
        onError(error instanceof Error ? error.message : String(error))
      }
    },
    [client, onError, worktreeId]
  )

  const confirmDeleteThread = useCallback(async () => {
    if (!deleteTarget) {
      return
    }
    const targetId = deleteTarget.id
    setDeleteTarget(null)
    const nextHidden = await hideGroupThread(hostId, group.id, targetId)
    setHiddenThreadIds(nextHidden)
    if (threadId === targetId) {
      onOpenRoom(undefined)
    }
  }, [deleteTarget, group.id, hostId, onOpenRoom, threadId])

  const newThread = t('bots.groups.newThreadTab', 'New thread')
  const visibleThreads = useMemo(
    () => filterVisibleBotGroupThreads(group.threads, hiddenThreadIds),
    [group.threads, hiddenThreadIds]
  )
  const rooms = useMemo(
    () => [
      { id: undefined as string | undefined, label: group.name, icon: Users },
      ...visibleThreads.map((thread) => ({
        id: thread.id,
        label: thread.title ?? newThread,
        icon: MessageSquare
      }))
    ],
    [group.name, newThread, visibleThreads]
  )
  const listed = rooms.find((room) => room.id === threadId)
  const active = listed ?? { id: threadId, label: newThread, icon: MessageSquare }
  const ActiveIcon = active.icon
  const count = rooms.length + (listed ? 0 : 1) + workspaceTabs.length
  const countLabel = t('session.tabBar.tabCount', '{{count}} tabs', { count })

  return (
    <View style={styles.bar}>
      <View style={styles.tabCell}>
        <Pressable
          style={({ pressed }) => [styles.tabPress, pressed && styles.cellPressed]}
          onPress={() => setListing(true)}
          accessibilityRole="button"
          accessibilityLabel={active.label}
          accessibilityHint={t('session.tabBar.hint', 'Shows all tabs')}
        >
          <View style={styles.tabContent}>
            <ActiveIcon size={14} color={colors.textSecondary} />
            <Text style={styles.title} numberOfLines={1}>
              {active.label}
            </Text>
          </View>
        </Pressable>
      </View>
      <Pressable
        style={({ pressed }) => [styles.sideCell, pressed && styles.cellPressed]}
        onPress={() => setListing(true)}
        accessibilityRole="button"
        accessibilityLabel={countLabel}
        accessibilityHint={t('session.tabBar.hint', 'Shows all tabs')}
      >
        <View style={styles.countBox}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.sideCell,
          styles.lastCell,
          pressed && styles.cellPressed,
          createDisabled && styles.cellDisabled
        ]}
        disabled={createDisabled}
        onPress={() => setCreating(true)}
        accessibilityRole="button"
        accessibilityLabel={t('session.sheets.newTab', 'New Tab')}
        accessibilityState={{ disabled: createDisabled }}
      >
        <Plus size={18} color={colors.textPrimary} strokeWidth={2.2} />
      </Pressable>

      <BottomDrawer
        visible={listing}
        onClose={() => setListing(false)}
        onAfterClose={() => {
          const run = afterListingCloseRef.current
          afterListingCloseRef.current = null
          run?.()
        }}
        dragContentToDismiss
      >
        <SheetHeader title={group.name} onClose={() => setListing(false)} />
        <SectionHeader title="话题" first />
        <ListGroup separatorInset={LIST_LEADING_INSET}>
          {rooms.map((room) => {
            const Icon = room.icon
            const selected = room.id === threadId
            const deletable = room.id !== undefined
            return (
              <ListRow
                key={room.id ?? 'main-room'}
                title={room.label}
                leading={<Icon size={16} color={colors.textSecondary} />}
                accessory={
                  <View style={barStyles.rowActions}>
                    {selected ? <Check size={16} color={colors.accentBlue} strokeWidth={2.3} /> : null}
                    {deletable ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`删除话题 ${room.label}`}
                        hitSlop={8}
                        style={({ pressed }) => [
                          barStyles.deleteBtn,
                          pressed && barStyles.deleteBtnPressed
                        ]}
                        onPress={() => {
                          const target = { id: room.id!, label: room.label }
                          afterListingCloseRef.current = () => setDeleteTarget(target)
                          setListing(false)
                        }}
                      >
                        <Trash2 size={15} color={colors.statusRed} />
                      </Pressable>
                    ) : null}
                  </View>
                }
                onPress={() => {
                  setListing(false)
                  onOpenRoom(room.id)
                }}
              />
            )
          })}
        </ListGroup>

        {workspaceTabs.length > 0 ? (
          <>
            <SectionHeader title="已打开的浏览器与工具" />
            <ListGroup separatorInset={LIST_LEADING_INSET}>
              {workspaceTabs.map((tab) => {
                const TabIcon =
                  tab.type === 'browser'
                    ? Globe
                    : tab.type === 'markdown'
                      ? FileText
                      : SquareTerminal
                return (
                  <ListRow
                    key={tab.id}
                    title={tab.title}
                    subtitle={tab.type === 'browser' && tab.url !== tab.title ? tab.url : undefined}
                    leading={<TabIcon size={16} color={colors.textSecondary} />}
                    accessory={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`关闭 ${tab.title}`}
                        hitSlop={8}
                        style={({ pressed }) => [
                          barStyles.deleteBtn,
                          pressed && barStyles.deleteBtnPressed
                        ]}
                        onPress={() => void closeWorkspaceTab(tab)}
                      >
                        <X size={15} color={colors.textMuted} />
                      </Pressable>
                    }
                    onPress={() => void openWorkspaceTab(tab)}
                  />
                )
              })}
            </ListGroup>
          </>
        ) : null}
      </BottomDrawer>

      <MobileBotGroupCreateSheet
        visible={creating}
        client={client}
        worktreeId={worktreeId}
        groupName={group.name}
        latestUrl={latestUrl}
        disabled={createDisabled}
        onClose={() => setCreating(false)}
        onNewThread={onNewThread}
        onOpenWorkspaceSession={openWorkspaceSession}
        onWorkspaceTabsChanged={() => void refreshWorkspaceTabs()}
        onError={onError}
      />

      <ConfirmModal
        visible={deleteTarget != null}
        title="删除话题"
        message={`确定删除「${deleteTarget?.label ?? ''}」吗？`}
        confirmLabel={t('common.delete', 'Delete')}
        destructive
        onConfirm={() => void confirmDeleteThread()}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  )
}

const barStyles = themedStyleSheet(() => ({
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center'
  },
  deleteBtnPressed: {
    backgroundColor: colors.bgRaised
  }
}))
