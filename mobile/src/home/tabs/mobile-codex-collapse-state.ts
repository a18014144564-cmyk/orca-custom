import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'
import type { MobileCodexProjectRow, MobileCodexTone } from './mobile-codex-projects'

const STORAGE_KEY = 'orca.custom.mobileCodexCollapseState.v2'

export type MobileCodexViewMode = 'tree' | 'recent'

export type MobileCodexCollapseState = Readonly<{
  collapsedHosts: ReadonlySet<string>
  /** Explicit per-project expand overrides; omitted keys expand only when a task is currently running. */
  projectExpandOverrides: Readonly<Record<string, boolean>>
  viewMode: MobileCodexViewMode
  onlyActive: boolean
}>

const listeners = new Set<() => void>()
let hydrated = false

let currentState: MobileCodexCollapseState = {
  collapsedHosts: new Set(),
  projectExpandOverrides: {},
  viewMode: 'tree',
  onlyActive: false
}

export function isMobileCodexRunningTone(tone: MobileCodexTone): boolean {
  return tone === 'working' || tone === 'attention'
}

export function mobileCodexProjectHasRunningTask(
  project: Pick<MobileCodexProjectRow, 'statusTone' | 'threads'>
): boolean {
  return (
    isMobileCodexRunningTone(project.statusTone) ||
    project.threads.some((thread) => isMobileCodexRunningTone(thread.statusTone))
  )
}

export function resolveMobileCodexProjectExpanded(
  project: Pick<MobileCodexProjectRow, 'key' | 'statusTone' | 'threads'>,
  overrides: Readonly<Record<string, boolean>>
): boolean {
  if (Object.hasOwn(overrides, project.key)) {
    return overrides[project.key] === true
  }
  return mobileCodexProjectHasRunningTask(project)
}

function toStringSet(value: unknown): ReadonlySet<string> {
  if (!Array.isArray(value)) {
    return new Set()
  }
  const next = new Set<string>()
  for (const item of value) {
    if (typeof item === 'string' && item.length > 0) {
      next.add(item)
    }
  }
  return next
}

function toBooleanMap(value: unknown): Readonly<Record<string, boolean>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  const next: Record<string, boolean> = {}
  for (const [key, flag] of Object.entries(value as Record<string, unknown>)) {
    if (key.length > 0 && typeof flag === 'boolean') {
      next[key] = flag
    }
  }
  return next
}

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

function hydrateOnce(): void {
  if (hydrated) {
    return
  }
  hydrated = true
  void AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (!raw) {
        return
      }
      const parsed = JSON.parse(raw) as {
        collapsedHosts?: unknown
        projectExpandOverrides?: unknown
        viewMode?: unknown
        onlyActive?: unknown
      } | null
      if (!parsed || typeof parsed !== 'object') {
        return
      }
      currentState = {
        collapsedHosts: toStringSet(parsed.collapsedHosts),
        projectExpandOverrides: toBooleanMap(parsed.projectExpandOverrides),
        viewMode: parsed.viewMode === 'recent' ? 'recent' : 'tree',
        onlyActive: parsed.onlyActive === true
      }
      notify()
    })
    .catch(() => undefined)
}

function commitState(next: MobileCodexCollapseState): void {
  currentState = next
  notify()
  void AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      collapsedHosts: [...next.collapsedHosts],
      projectExpandOverrides: next.projectExpandOverrides,
      viewMode: next.viewMode,
      onlyActive: next.onlyActive
    })
  ).catch(() => undefined)
}

function toggleInSet(source: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(source)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  return next
}

export function toggleMobileCodexHostCollapsed(hostId: string): void {
  commitState({ ...currentState, collapsedHosts: toggleInSet(currentState.collapsedHosts, hostId) })
}

export function toggleMobileCodexProjectExpanded(
  projectKey: string,
  currentlyExpanded: boolean
): void {
  commitState({
    ...currentState,
    projectExpandOverrides: {
      ...currentState.projectExpandOverrides,
      [projectKey]: !currentlyExpanded
    }
  })
}

export function setMobileCodexAllProjectsExpanded(
  projectKeys: readonly string[],
  expanded: boolean
): void {
  const next: Record<string, boolean> = { ...currentState.projectExpandOverrides }
  let changed = false
  for (const key of projectKeys) {
    if (next[key] !== expanded) {
      next[key] = expanded
      changed = true
    }
  }
  if (changed) {
    commitState({ ...currentState, projectExpandOverrides: next })
  }
}

export function setMobileCodexViewMode(viewMode: MobileCodexViewMode): void {
  if (currentState.viewMode !== viewMode) {
    commitState({ ...currentState, viewMode })
  }
}

export function toggleMobileCodexOnlyActive(): void {
  commitState({ ...currentState, onlyActive: !currentState.onlyActive })
}

export function useMobileCodexCollapseState(): MobileCodexCollapseState {
  hydrateOnce()
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => currentState,
    () => currentState
  )
}
