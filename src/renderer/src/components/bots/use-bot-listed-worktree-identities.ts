import { useAppStoreWithHostStatuses } from '@/store/slices/runtime-status/views/use-runtime-status-view'
import { useMemo } from 'react'
import { useBots, useBotsEnabled } from '@/lib/bot-catalog'
import { useBotGroups } from '@/lib/bot-group-list'
import { useAppStore } from '@/store'
import { selectFolderWorkspaces } from '@/store/workspaces/catalog/workspace-record-fields'
import { selectSidebarChildrenByParentIdentity } from '@/store/slices/worktrees/metadata/cross-store-lineage-parents'
import { getBotHomes, getBotListedWorktreeIdentities } from '../../../../shared/bots/bot-homes'
import type { Worktree } from '../../../../shared/worktree/types'

const NONE: ReadonlySet<string> = new Set()
const NO_CHILDREN: ReadonlyMap<string, readonly Worktree[]> = new Map()

/** The worktrees to leave out of project lists: always exclude Bot Team child worktrees, and also
 *  exclude individual Bot child worktrees while Hide bot workspaces is on. */
export function useBotListedWorktreeIdentities(): ReadonlySet<string> {
  const hideBotCreated = useAppStore((s) => s.hideBotCreatedWorkspaces)
  const botsEnabled = useBotsEnabled()
  const bots = useBots(hideBotCreated && botsEnabled)
  const groups = useBotGroups(botsEnabled)
  const owners = useMemo(() => [...bots, ...groups], [bots, groups])
  const folderWorkspaces = useAppStore((s) => selectFolderWorkspaces(s))
  // With no bot/group to list, Projects skip the sidebar-wide children projection.
  const childrenByParent = useAppStoreWithHostStatuses((s, statuses) =>
    owners.length === 0 ? NO_CHILDREN : selectSidebarChildrenByParentIdentity(s, statuses)
  )
  return useMemo(
    () =>
      owners.length === 0
        ? NONE
        : getBotListedWorktreeIdentities(
            getBotHomes(owners, folderWorkspaces).map(({ home }) => home),
            childrenByParent
          ),
    [owners, folderWorkspaces, childrenByParent]
  )
}
