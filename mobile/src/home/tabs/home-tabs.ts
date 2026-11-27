import { Easing } from 'react-native-reanimated'

export type FourZoneHomeTabId = 'teams' | 'bots' | 'projects' | 'usage'
export type FiveSlotHomeTabId = FourZoneHomeTabId | 'running'
export type ClassicHomeTabId = 'feed' | 'bots' | 'agents' | 'usage' | 'automations'
export type HomeTabId = FiveSlotHomeTabId | ClassicHomeTabId

export const FOUR_ZONE_HOME_TABS: readonly FourZoneHomeTabId[] = [
  'teams',
  'bots',
  'projects',
  'usage'
]
export const CLASSIC_HOME_TABS: readonly ClassicHomeTabId[] = [
  'feed',
  'bots',
  'agents',
  'usage',
  'automations'
]
export const HOME_TABS: readonly HomeTabId[] = FOUR_ZONE_HOME_TABS

/** Inserts the live cross-device "运行中" tab right in the center C-slot of the 4 customizable tabs. */
export function buildFiveSlotMobileTabs(
  fourZoneOrder: readonly FourZoneHomeTabId[]
): readonly FiveSlotHomeTabId[] {
  const firstTwo = fourZoneOrder.slice(0, 2)
  const rest = fourZoneOrder.slice(2)
  return [...firstTwo, 'running', ...rest]
}

/** Strong ease-out for things entering or reacting to a touch. */
export const HOME_EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
