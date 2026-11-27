import { requireOptionalNativeModule, type NativeModule } from 'expo-modules-core'

/** A rect in window points, the root view's coordinates. */
export type ReservedRect = { x: number; y: number; width: number; height: number }

export type WindowSafeArea = {
  bounds: ReservedRect
  insets: { top: number; right: number; bottom: number; left: number }
}

export type FoldPostureState = 'flat' | 'half-opened' | 'none'
export type FoldHingeOrientation = 'vertical' | 'horizontal' | 'none'

/** The window's active reserved regions: a fold's crease/hinge, posture, and camera occlusions. */
export type ReservedRegions = {
  divisions: ReservedRect[]
  hasFoldDivision?: boolean
  occlusions: ReservedRect[]
  keyboardInset?: number
  windowSafeArea?: WindowSafeArea
  /** Android Jetpack WindowManager foldable posture; absent on iOS/web. */
  foldPosture?: FoldPostureState
  foldOrientation?: FoldHingeOrientation
  foldSeparating?: boolean
}

type ReservedRegionsEvents = {
  /** Sent once the module starts observing, then whenever the active regions change. */
  onChange: (regions: ReservedRegions) => void
}

declare class OrcaReservedRegionsModule extends NativeModule<ReservedRegionsEvents> {
  getCurrentRegions?: () => ReservedRegions | null
}

/**
 * Native fold/reserved-region observer (iOS 27.1+ reserved regions & Android Jetpack WindowManager).
 */
export const OrcaReservedRegions =
  requireOptionalNativeModule<OrcaReservedRegionsModule>('OrcaReservedRegions')
