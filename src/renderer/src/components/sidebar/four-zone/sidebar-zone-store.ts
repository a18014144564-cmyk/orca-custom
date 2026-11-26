import { useSyncExternalStore } from 'react'
import {
  readStoredSidebarZoneMode,
  writeStoredSidebarZoneMode,
  type SidebarZoneMode
} from './sidebar-four-zone-model'

let currentZoneMode: SidebarZoneMode = readStoredSidebarZoneMode()
const listeners = new Set<() => void>()

export function getSidebarZoneMode(): SidebarZoneMode {
  return currentZoneMode
}

export function setSidebarZoneMode(next: SidebarZoneMode): void {
  if (currentZoneMode === next) {
    return
  }
  currentZoneMode = next
  writeStoredSidebarZoneMode(next)
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSidebarZoneMode(): SidebarZoneMode {
  return useSyncExternalStore(subscribe, getSidebarZoneMode, getSidebarZoneMode)
}
