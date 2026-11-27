import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'orca.custom.mobileCodexCollapseState.v1'

export type MobileCodexViewMode = 'tree' | 'recent'

export type MobileCodexCollapseState = Readonly<{
  collapsedHosts: ReadonlySet<string>
  collapsedProjects: ReadonlySet<string>
  viewMode: MobileCodexViewMode
  onlyActive: boolean
}>

const listeners = new Set<() => void>()
let hydrated = false

let currentState: MobileCodexCollapseState = {
  collapsedHosts: new Set(),
  collapsedProjects: new Set(),
  viewMode: 'tree',
  onlyActive: false
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
        collapsedProjects?: unknown
        viewMode?: unknown
        onlyActive?: unknown
      } | null
      if (!parsed || typeof parsed !== 'object') {
        return
      }
      currentState = {
        collapsedHosts: toStringSet(parsed.collapsedHosts),
        collapsedProjects: toStringSet(parsed.collapsedProjects),
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
      collapsedProjects: [...next.collapsedProjects],
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

export function toggleMobileCodexProjectCollapsed(projectKey: string): void {
  commitState({
    ...currentState,
    collapsedProjects: toggleInSet(currentState.collapsedProjects, projectKey)
  })
}

export function setMobileCodexAllProjectsCollapsed(
  projectKeys: readonly string[],
  collapse: boolean
): void {
  const next = new Set(currentState.collapsedProjects)
  let changed = false
  for (const key of projectKeys) {
    if (collapse) {
      if (!next.has(key)) {
        next.add(key)
        changed = true
      }
    } else if (next.delete(key)) {
      changed = true
    }
  }
  if (changed) {
    commitState({ ...currentState, collapsedProjects: next })
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
