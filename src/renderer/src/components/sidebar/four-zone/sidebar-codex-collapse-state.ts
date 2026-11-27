import { useSyncExternalStore } from 'react'
import type { CodexActivityTone, CodexProjectRow } from './sidebar-codex-types'

const STORAGE_KEY = 'orca.custom.codexCollapseState.v2'

export type CodexViewMode = 'tree' | 'recent'

export type CodexCollapseState = Readonly<{
  collapsedHosts: ReadonlySet<string>
  /** Explicit per-project expand overrides (`true` = forced open, `false` = forced closed). Omitted keys use smart default (only running-task projects expand). */
  projectExpandOverrides: Readonly<Record<string, boolean>>
  collapsedBotHosts: ReadonlySet<string>
  viewMode: CodexViewMode
  onlyActive: boolean
}>

type StoredPayload = {
  collapsedHosts?: unknown
  projectExpandOverrides?: unknown
  collapsedBotHosts?: unknown
  viewMode?: unknown
  onlyActive?: unknown
}

const listeners = new Set<() => void>()

export function isCodexRunningTone(tone: CodexActivityTone): boolean {
  return tone === 'working' || tone === 'attention'
}

export function codexProjectHasRunningTask(
  project: Pick<CodexProjectRow, 'statusTone' | 'threads'>
): boolean {
  return (
    isCodexRunningTone(project.statusTone) ||
    project.threads.some((thread) => isCodexRunningTone(thread.statusTone))
  )
}

/** Smart default: only projects with an active running/attention task expand automatically; idle projects stay collapsed unless manually expanded. */
export function resolveCodexProjectExpanded(
  project: Pick<CodexProjectRow, 'key' | 'statusTone' | 'threads'>,
  overrides: Readonly<Record<string, boolean>>
): boolean {
  if (Object.hasOwn(overrides, project.key)) {
    return overrides[project.key] === true
  }
  return codexProjectHasRunningTask(project)
}

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

function readStoredState(): CodexCollapseState {
  const fallback: CodexCollapseState = {
    collapsedHosts: new Set(),
    projectExpandOverrides: {},
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
      projectExpandOverrides: toBooleanMap(parsed.projectExpandOverrides),
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
          projectExpandOverrides: next.projectExpandOverrides,
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

export function toggleCodexProjectExpanded(projectKey: string, currentlyExpanded: boolean): void {
  commitState({
    ...currentState,
    projectExpandOverrides: {
      ...currentState.projectExpandOverrides,
      [projectKey]: !currentlyExpanded
    }
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
  const needProject = Boolean(projectKey && currentState.projectExpandOverrides[projectKey] !== true)
  if (!needHost && !needProject) {
    return
  }
  const collapsedHosts = needHost ? new Set(currentState.collapsedHosts) : currentState.collapsedHosts
  if (needHost && hostId) {
    (collapsedHosts as Set<string>).delete(hostId)
  }
  const projectExpandOverrides = needProject && projectKey
    ? { ...currentState.projectExpandOverrides, [projectKey]: true }
    : currentState.projectExpandOverrides
  commitState({ ...currentState, collapsedHosts, projectExpandOverrides })
}

export function setCodexAllProjectsExpanded(
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
