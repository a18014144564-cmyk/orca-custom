import { useSyncExternalStore } from 'react'
import {
  higherCodexTone,
  type CodexProjectRow,
  type CodexRecentRow
} from './sidebar-codex-types'

const STORAGE_KEY = 'orca.custom.codexThreadProjectMap'
const listeners = new Set<() => void>()

let currentMap: Readonly<Record<string, string>> = readStoredMap()

function readStoredMap(): Readonly<Record<string, string>> {
  if (typeof window === 'undefined') {
    return {}
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {}
    }
    const clean: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === 'string' && typeof v === 'string' && k.length > 0 && v.length > 0) {
        clean[k] = v
      }
    }
    return clean
  } catch {
    return {}
  }
}

function commitMap(next: Readonly<Record<string, string>>): void {
  currentMap = next
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Ignore storage quota errors.
    }
  }
  for (const listener of listeners) {
    listener()
  }
}

export function moveCodexThreadToProject(threadKey: string, targetProjectKey: string): void {
  if (currentMap[threadKey] === targetProjectKey) {
    return
  }
  commitMap({ ...currentMap, [threadKey]: targetProjectKey })
}

export function resetCodexThreadProject(threadKey: string): void {
  if (!(threadKey in currentMap)) {
    return
  }
  const next = { ...currentMap }
  delete next[threadKey]
  commitMap(next)
}

export function useCodexThreadProjectMap(): Readonly<Record<string, string>> {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => currentMap,
    () => currentMap
  )
}

export function applyCodexThreadProjectOverrides(
  projects: readonly CodexProjectRow[],
  overrides: Readonly<Record<string, string>> | undefined
): void {
  if (!overrides || Object.keys(overrides).length === 0) {
    return
  }
  const projectByKey = new Map(projects.map((project) => [project.key, project]))
  for (const project of projects) {
    const kept: CodexRecentRow[] = []
    for (const thread of project.threads) {
      const targetKey = overrides[thread.key]
      const target = targetKey && targetKey !== project.key ? projectByKey.get(targetKey) : undefined
      if (target) {
        target.threads.push(thread)
        target.statusTone = higherCodexTone(target.statusTone, thread.statusTone)
        target.lastActivityAt = Math.max(target.lastActivityAt, thread.timestamp)
      } else {
        kept.push(thread)
      }
    }
    project.threads = kept
  }
  for (const project of projects) {
    project.threads.sort((a, b) => b.timestamp - a.timestamp || a.title.localeCompare(b.title))
  }
}
