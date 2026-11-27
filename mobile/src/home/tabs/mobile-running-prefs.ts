import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'orca.custom.mobileRunningWindowsPrefs.v1'

/** Preset auto-hide durations (ms) for idle windows; `null` keeps idle windows until manually cleared. */
export const IDLE_HIDE_PRESETS: readonly { readonly ms: number | null; readonly label: string; readonly shortLabel: string }[] = [
  { ms: 0, label: '跑完立即消失', shortLabel: '跑完即隐' },
  { ms: 5 * 60_000, label: '不聊 5 分钟后消失', shortLabel: '5m' },
  { ms: 15 * 60_000, label: '不聊 15 分钟后消失', shortLabel: '15m' },
  { ms: 30 * 60_000, label: '不聊 30 分钟后消失（默认）', shortLabel: '30m' },
  { ms: 60 * 60_000, label: '不聊 1 小时后消失', shortLabel: '1h' },
  { ms: 120 * 60_000, label: '不聊 2 小时后消失', shortLabel: '2h' },
  { ms: null, label: '永不自动消失（仅手动清理）', shortLabel: '常驻' }
]

export const DEFAULT_IDLE_HIDE_MS = 30 * 60_000

export type MobileRunningWindowsPrefs = Readonly<{
  idleHideMs: number | null
  groupByDevice: boolean
  /** Window key -> timestamp when dismissed; auto-resurfaces if new activity occurs or task runs again. */
  dismissedAtByKey: Readonly<Record<string, number>>
}>

const listeners = new Set<() => void>()
let hydrated = false
let currentPrefs: MobileRunningWindowsPrefs = {
  idleHideMs: DEFAULT_IDLE_HIDE_MS,
  groupByDevice: false,
  dismissedAtByKey: {}
}

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

function normalizeIdleHideMs(value: unknown): number | null {
  if (value === null) {
    return null
  }
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value
  }
  return DEFAULT_IDLE_HIDE_MS
}

function normalizeDismissedMap(value: unknown): Readonly<Record<string, number>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  const out: Record<string, number> = {}
  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 200)
  for (const [k, v] of entries) {
    out[k] = v
  }
  return out
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
        idleHideMs: 'idleHideMs' in parsed ? normalizeIdleHideMs(parsed.idleHideMs) : DEFAULT_IDLE_HIDE_MS,
        groupByDevice: parsed.groupByDevice === true,
        dismissedAtByKey: normalizeDismissedMap(parsed.dismissedAtByKey)
      }
      notify()
    })
    .catch(() => undefined)
}

function commitPrefs(next: MobileRunningWindowsPrefs): void {
  currentPrefs = next
  notify()
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined)
}

export function setMobileRunningIdleHideMs(idleHideMs: number | null): void {
  if (currentPrefs.idleHideMs !== idleHideMs) {
    commitPrefs({ ...currentPrefs, idleHideMs })
  }
}

export function toggleMobileRunningGroupByDevice(): void {
  commitPrefs({ ...currentPrefs, groupByDevice: !currentPrefs.groupByDevice })
}

export function dismissMobileRunningWindows(
  items: readonly { readonly key: string; readonly lastActivityAt: number }[],
  now: number = Date.now()
): void {
  if (items.length === 0) {
    return
  }
  const nextMap: Record<string, number> = { ...currentPrefs.dismissedAtByKey }
  for (const item of items) {
    nextMap[item.key] = Math.max(now, item.lastActivityAt)
  }
  commitPrefs({ ...currentPrefs, dismissedAtByKey: normalizeDismissedMap(nextMap) })
}

export function useMobileRunningWindowsPrefs(): MobileRunningWindowsPrefs {
  hydrateOnce()
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => currentPrefs,
    () => currentPrefs
  )
}

export function formatIdleHideShortLabel(ms: number | null): string {
  const preset = IDLE_HIDE_PRESETS.find((p) => p.ms === ms)
  if (preset) {
    return preset.shortLabel
  }
  if (ms === null) {
    return '常驻'
  }
  if (ms === 0) {
    return '跑完即隐'
  }
  const mins = Math.round(ms / 60_000)
  return mins >= 60 ? `${Math.round(mins / 60)}h` : `${mins}m`
}
