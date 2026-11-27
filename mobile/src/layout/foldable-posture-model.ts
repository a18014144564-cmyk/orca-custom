import type { ReservedRegions } from '../../modules/orca-reserved-regions/src'

export type FoldablePosture = 'cover' | 'unfolded' | 'tabletop'

export type FoldablePostureMetrics = Readonly<{
  width: number
  height: number
  posture: FoldablePosture
  isUnfoldedWorkbench: boolean
  isTabletop: boolean
  hingeAxis: 'vertical' | 'horizontal' | 'none'
  hingeGap: number
  hingeCenter: number | null
  midPaneWidth: number
}>

const UNFOLDED_MIN_WIDTH = 620
const UNFOLDED_MIN_SHORT_SIDE = 540
const TABLETOP_MIN_HEIGHT = 480
const DEFAULT_HINGE_GAP = 12
const MIN_HINGE_GAP = 12
const MAX_HINGE_GAP = 32

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function resolveFoldablePosture(args: {
  width: number
  height: number
  platform: string
  regions: ReservedRegions
}): FoldablePostureMetrics {
  const { width, height, platform, regions } = args
  const shortSide = Math.min(width, height)
  const firstDivision = regions.divisions[0] ?? null

  const isHorizontalHalfFold =
    regions.foldPosture === 'half-opened' &&
    regions.foldOrientation === 'horizontal' &&
    height >= TABLETOP_MIN_HEIGHT

  if (isHorizontalHalfFold) {
    const rawGap = firstDivision ? firstDivision.height : DEFAULT_HINGE_GAP
    const hingeGap = clamp(rawGap, MIN_HINGE_GAP, MAX_HINGE_GAP)
    const hingeCenter = firstDivision ? firstDivision.y + firstDivision.height / 2 : height * 0.54
    return {
      width,
      height,
      posture: 'tabletop',
      isUnfoldedWorkbench: false,
      isTabletop: true,
      hingeAxis: 'horizontal',
      hingeGap,
      hingeCenter,
      midPaneWidth: 256
    }
  }

  // Honor Magic V6 unfolded inner screen is ~720-840dp wide with a near-1:1 aspect ratio,
  // while the outer cover screen (~360-430dp) and landscape phones (shortSide < 460dp) stay 'cover'.
  const qualifiesAndroidFoldable =
    platform === 'android' && width >= UNFOLDED_MIN_WIDTH && shortSide >= UNFOLDED_MIN_SHORT_SIDE
  const qualifiesLargeTablet = platform !== 'android' && width >= 820 && shortSide >= 680

  if (qualifiesAndroidFoldable || qualifiesLargeTablet) {
    const isVerticalDiv = firstDivision ? firstDivision.height >= firstDivision.width : true
    const rawGap = firstDivision && isVerticalDiv ? firstDivision.width : DEFAULT_HINGE_GAP
    const hingeGap = clamp(rawGap, MIN_HINGE_GAP, MAX_HINGE_GAP)
    const hingeCenter =
      firstDivision && isVerticalDiv ? firstDivision.x + firstDivision.width / 2 : width / 2
    const midPaneWidth = clamp(Math.round(width * 0.33), 248, 286)
    return {
      width,
      height,
      posture: 'unfolded',
      isUnfoldedWorkbench: true,
      isTabletop: false,
      hingeAxis: 'vertical',
      hingeGap,
      hingeCenter,
      midPaneWidth
    }
  }

  return {
    width,
    height,
    posture: 'cover',
    isUnfoldedWorkbench: false,
    isTabletop: false,
    hingeAxis: 'none',
    hingeGap: 0,
    hingeCenter: null,
    midPaneWidth: 256
  }
}
