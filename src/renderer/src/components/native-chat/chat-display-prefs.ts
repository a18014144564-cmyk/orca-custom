import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'orca.custom.desktopChatDisplayPrefs.v1'

export type DesktopChatDisplayPrefs = Readonly<{
  showToolDetails: boolean
  showReasoning: boolean
}>

const DEFAULT_PREFS: DesktopChatDisplayPrefs = {
  showToolDetails: false,
  showReasoning: true
}

const listeners = new Set<() => void>()
let initialized = false
let currentPrefs: DesktopChatDisplayPrefs = DEFAULT_PREFS

function loadOnce(): void {
  if (initialized) {
    return
  }
  initialized = true
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (!raw) {
      return
    }
    const parsed = JSON.parse(raw) as Record<string, unknown> | null
    if (!parsed || typeof parsed !== 'object') {
      return
    }
    currentPrefs = {
      showToolDetails: parsed.showToolDetails === true,
      showReasoning: parsed.showReasoning !== false
    }
  } catch {
    // Ignore storage failures in test or restricted contexts.
  }
}

function commit(next: DesktopChatDisplayPrefs): void {
  currentPrefs = next
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
  } catch {
    // Ignore storage write failures.
  }
  for (const listener of listeners) {
    listener()
  }
}

export function getDesktopChatDisplayPrefs(): DesktopChatDisplayPrefs {
  loadOnce()
  return currentPrefs
}

export function subscribeDesktopChatDisplayPrefs(listener: () => void): () => void {
  loadOnce()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useDesktopChatDisplayPrefs(): DesktopChatDisplayPrefs {
  return useSyncExternalStore(
    subscribeDesktopChatDisplayPrefs,
    getDesktopChatDisplayPrefs,
    () => DEFAULT_PREFS
  )
}

export function toggleDesktopChatReasoning(): void {
  const cur = getDesktopChatDisplayPrefs()
  commit({ ...cur, showReasoning: !cur.showReasoning })
}

export function toggleDesktopChatToolDetails(): void {
  const cur = getDesktopChatDisplayPrefs()
  commit({ ...cur, showToolDetails: !cur.showToolDetails })
}
