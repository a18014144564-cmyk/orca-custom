import { useSyncExternalStore } from 'react'
import {
  DEFAULT_SIDEBAR_ZONE_ORDER,
  normalizeSidebarZoneOrder,
  readStoredSidebarZoneMode,
  readStoredSidebarZoneOrder,
  writeStoredSidebarZoneMode,
  writeStoredSidebarZoneOrder,
  type SidebarZoneMode
} from './sidebar-four-zone-model'

let currentZoneMode: SidebarZoneMode = readStoredSidebarZoneMode()
let currentZoneOrder: readonly SidebarZoneMode[] = readStoredSidebarZoneOrder()
const modeListeners = new Set<() => void>()
const orderListeners = new Set<() => void>()

export function getSidebarZoneMode(): SidebarZoneMode {
  return currentZoneMode
}

export function setSidebarZoneMode(next: SidebarZoneMode): void {
  if (currentZoneMode === next) {
    return
  }
  currentZoneMode = next
  writeStoredSidebarZoneMode(next)
  for (const listener of modeListeners) {
    listener()
  }
}

function subscribeMode(listener: () => void): () => void {
  modeListeners.add(listener)
  return () => {
    modeListeners.delete(listener)
  }
}

export function useSidebarZoneMode(): SidebarZoneMode {
  return useSyncExternalStore(subscribeMode, getSidebarZoneMode, getSidebarZoneMode)
}

export function getSidebarZoneOrder(): readonly SidebarZoneMode[] {
  return currentZoneOrder
}

export function setSidebarZoneOrder(next: readonly SidebarZoneMode[]): void {
  const normalized = normalizeSidebarZoneOrder(next)
  if (
    normalized.length === currentZoneOrder.length &&
    normalized.every((mode, index) => mode === currentZoneOrder[index])
  ) {
    return
  }
  currentZoneOrder = normalized
  writeStoredSidebarZoneOrder(normalized)
  for (const listener of orderListeners) {
    listener()
  }
}

export function resetSidebarZoneOrder(): void {
  setSidebarZoneOrder(DEFAULT_SIDEBAR_ZONE_ORDER)
}

function subscribeOrder(listener: () => void): () => void {
  orderListeners.add(listener)
  return () => {
    orderListeners.delete(listener)
  }
}

export function useSidebarZoneOrder(): readonly SidebarZoneMode[] {
  return useSyncExternalStore(subscribeOrder, getSidebarZoneOrder, getSidebarZoneOrder)
}
