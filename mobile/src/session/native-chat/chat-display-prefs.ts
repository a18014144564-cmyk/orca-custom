import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'orca.custom.mobileChatDisplayPrefs.v1'

export type MobileChatDisplayPrefs = Readonly<{
  /** Hide noisy tool/command/file-edit detail rows by default; show only conclusions + optional reasoning. */
  showToolDetails: boolean
  /** Show reasoning ("过程思考") disclosure rows; user can turn off for pure text replies. */
  showReasoning: boolean
}>

const DEFAULT_PREFS: MobileChatDisplayPrefs = {
  showToolDetails: false,
  showReasoning: true
}

const listeners = new Set<() => void>()
let hydrated = false
let currentPrefs: MobileChatDisplayPrefs = DEFAULT_PREFS

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
      const parsed = JSON.parse(raw) as Record<string, unknown> | null
      if (!parsed || typeof parsed !== 'object') {
        return
      }
      currentPrefs = {
        showToolDetails: parsed.showToolDetails === true,
        showReasoning: parsed.showReasoning !== false
      }
      notify()
    })
    .catch(() => undefined)
}

function commit(next: MobileChatDisplayPrefs): void {
  currentPrefs = next
  notify()
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined)
}

export function getMobileChatDisplayPrefs(): MobileChatDisplayPrefs {
  hydrateOnce()
  return currentPrefs
}

export function subscribeMobileChatDisplayPrefs(listener: () => void): () => void {
  hydrateOnce()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useMobileChatDisplayPrefs(): MobileChatDisplayPrefs {
  return useSyncExternalStore(
    subscribeMobileChatDisplayPrefs,
    getMobileChatDisplayPrefs,
    () => DEFAULT_PREFS
  )
}

export function toggleMobileChatReasoning(): void {
  const cur = getMobileChatDisplayPrefs()
  commit({ ...cur, showReasoning: !cur.showReasoning })
}

export function toggleMobileChatToolDetails(): void {
  const cur = getMobileChatDisplayPrefs()
  commit({ ...cur, showToolDetails: !cur.showToolDetails })
}
