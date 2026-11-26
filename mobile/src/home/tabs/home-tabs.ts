import { Easing } from 'react-native-reanimated'

export type FourZoneHomeTabId = 'teams' | 'bots' | 'win' | 'mac'
export type ClassicHomeTabId = 'feed' | 'bots' | 'agents' | 'usage' | 'automations'
export type HomeTabId = FourZoneHomeTabId | ClassicHomeTabId

export const FOUR_ZONE_HOME_TABS: readonly FourZoneHomeTabId[] = ['teams', 'bots', 'win', 'mac']
export const CLASSIC_HOME_TABS: readonly ClassicHomeTabId[] = [
  'feed',
  'bots',
  'agents',
  'usage',
  'automations'
]
export const HOME_TABS: readonly HomeTabId[] = FOUR_ZONE_HOME_TABS

/** Strong ease-out for things entering or reacting to a touch. */
export const HOME_EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
