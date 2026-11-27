import AsyncStorage from '@react-native-async-storage/async-storage'
import { FOUR_ZONE_HOME_TABS, type FourZoneHomeTabId } from './home-tabs'

export const MOBILE_FOUR_ZONE_TAB_ORDER_STORAGE_KEY = 'orca.custom.mobileFourZoneTabOrder'

const VALID_FOUR_ZONE_TABS: ReadonlySet<string> = new Set(FOUR_ZONE_HOME_TABS)

export function normalizeMobileFourZoneTabOrder(raw: unknown): FourZoneHomeTabId[] {
  const result: FourZoneHomeTabId[] = []
  const seen = new Set<FourZoneHomeTabId>()
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string' && VALID_FOUR_ZONE_TABS.has(item)) {
        const id = item as FourZoneHomeTabId
        if (!seen.has(id)) {
          seen.add(id)
          result.push(id)
        }
      }
    }
  }
  for (const id of FOUR_ZONE_HOME_TABS) {
    if (!seen.has(id)) {
      seen.add(id)
      result.push(id)
    }
  }
  return result
}

export function moveMobileTabToFirst(
  order: readonly FourZoneHomeTabId[],
  tab: FourZoneHomeTabId
): FourZoneHomeTabId[] {
  const normalized = normalizeMobileFourZoneTabOrder(order)
  const index = normalized.indexOf(tab)
  if (index <= 0) {
    return normalized
  }
  const next = [...normalized]
  const [moved] = next.splice(index, 1)
  next.unshift(moved!)
  return next
}

export function moveMobileTabByOffset(
  order: readonly FourZoneHomeTabId[],
  tab: FourZoneHomeTabId,
  delta: -1 | 1
): FourZoneHomeTabId[] {
  const normalized = normalizeMobileFourZoneTabOrder(order)
  const index = normalized.indexOf(tab)
  const targetIndex = index + delta
  if (index === -1 || targetIndex < 0 || targetIndex >= normalized.length) {
    return normalized
  }
  const next = [...normalized]
  const [moved] = next.splice(index, 1)
  next.splice(targetIndex, 0, moved!)
  return next
}

export async function loadMobileFourZoneTabOrder(): Promise<FourZoneHomeTabId[]> {
  try {
    const raw = await AsyncStorage.getItem(MOBILE_FOUR_ZONE_TAB_ORDER_STORAGE_KEY)
    if (raw) {
      return normalizeMobileFourZoneTabOrder(JSON.parse(raw))
    }
  } catch {
    // Ignore storage read/parse failures.
  }
  return [...FOUR_ZONE_HOME_TABS]
}

export async function saveMobileFourZoneTabOrder(
  order: readonly FourZoneHomeTabId[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      MOBILE_FOUR_ZONE_TAB_ORDER_STORAGE_KEY,
      JSON.stringify(normalizeMobileFourZoneTabOrder(order))
    )
  } catch {
    // Ignore storage write failures.
  }
}
