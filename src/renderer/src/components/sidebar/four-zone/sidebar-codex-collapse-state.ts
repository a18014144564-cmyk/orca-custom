import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'orca.custom.codexCollapseState.v1'

export type CodexViewMode = 'tree' | 'recent'

export type CodexCollapseState = Readonly<{
  collapsedHosts: ReadonlySet<string>
  collapsedProjects: ReadonlySet<string>
  collapsedBotHosts: ReadonlySet<string>
  viewMode: CodexViewMode
  onlyActive: boolean
}>

type StoredPayload = {
  collapsedHosts?: unknown
  collapsedProjects?: unknown
  collapsedBotHosts?: unknown
  viewMode?: unknown
  onlyActive?: unknown
}

const listeners = new Set<() => void>()

function toStringSet(value: unknown): ReadonlySet<string> {
  if (!Array.isArray(value)) {
    return new Set()
  }
  const next = new Set<string>()
  for (const entry of value) {
    if (typeof entry === 'string' && entry.length > 0) {
      next.add(entry)
    }
  }
  return next
}

function readStoredState(): CodexCollapseState {
  const fallback: CodexCollapseState = {
    collapsedHosts: new Set(),
    collapsedProjects: new Set(),
    collapsedBotHosts: new Set(),
    viewMode: 'tree',
    onlyActive: false
  }
  if (typeof window === 'undefined') {
    return fallback
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return fallback
    }
    const parsed = JSON.parse(raw) as StoredPayload | null
    if (!parsed || typeof parsed !== 'object') {
      return fallback
    }
    return {
      collapsedHosts: toStringSet(parsed.collapsedHosts),
      collapsedProjects: toStringSet(parsed.collapsedProjects),
      collapsedBotHosts: toStringSet(parsed.collapsedBotHosts),
      viewMode: parsed.viewMode === 'recent' ? 'recent' : 'tree',
      onlyActive: parsed.onlyActive === true
    }
  } catch {
    return fallback
  }
}

let currentState: CodexCollapseState = readStoredState()

function commitState(next: CodexCollapseState): void {
  currentState = next
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          collapsedHosts: [...next.collapsedHosts],
          collapsedProjects: [...next.collapsedProjects],
          collapsedBotHosts: [...next.collapsedBotHosts],
          viewMode: next.viewMode,
          onlyActive: next.onlyActive
        })
      )
    } catch {
      // Ignore storage quota errors.
    }
  }
  for (const listener of listeners) {
    listener()
  }
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

export function toggleCodexHostCollapsed(hostId: string): void {
  commitState({ ...currentState, collapsedHosts: toggleInSet(currentState.collapsedHosts, hostId) })
}

export function toggleCodexProjectCollapsed(projectKey: string): void {
  commitState({
    ...currentState,
    collapsedProjects: toggleInSet(currentState.collapsedProjects, projectKey)
  })
}

export function toggleCodexBotHostCollapsed(hostId: string): void {
  commitState({
    ...currentState,
    collapsedBotHosts: toggleInSet(currentState.collapsedBotHosts, hostId)
  })
}

export function ensureCodexExpanded(hostId?: string | null, projectKey?: string | null): void {
  const needHost = Boolean(hostId && currentState.collapsedHosts.has(hostId))
  const needProject = Boolean(projectKey && currentState.collapsedProjects.has(projectKey))
  if (!needHost && !needProject) {
    return
  }
  const collapsedHosts = needHost ? new Set(currentState.collapsedHosts) : currentState.collapsedHosts
  const collapsedProjects = needProject
    ? new Set(currentState.collapsedProjects)
    : currentState.collapsedProjects
  if (needHost && hostId) {
    (collapsedHosts as Set<string>).delete(hostId)
  }
  if (needProject && projectKey) {
    (collapsedProjects as Set<string>).delete(projectKey)
  }
  commitState({ ...currentState, collapsedHosts, collapsedProjects })
}

export function setCodexAllProjectsCollapsed(
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

export function setCodexViewMode(viewMode: CodexViewMode): void {
  if (currentState.viewMode !== viewMode) {
    commitState({ ...currentState, viewMode })
  }
}

export function toggleCodexOnlyActive(): void {
  commitState({ ...currentState, onlyActive: !currentState.onlyActive })
}

export function useCodexCollapseState(): CodexCollapseState {
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
