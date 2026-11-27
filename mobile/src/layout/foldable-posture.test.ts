import { describe, expect, it } from 'vitest'
import { resolveFoldablePosture } from './foldable-posture-model'
import {
  buildFoldableAuxRoute,
  buildFoldableStageRoute,
  foldableStageHref,
  foldableStageKey
} from '../home/foldable/foldable-stage-types'
import type { ReservedRegions } from '../../modules/orca-reserved-regions/src'

const EMPTY_REGIONS: ReservedRegions = { divisions: [], occlusions: [] }

describe('resolveFoldablePosture (Honor Magic V6 & Android foldables)', () => {
  it('keeps Honor Magic V6 outer cover screen and landscape phones in single-column cover mode', () => {
    const cover = resolveFoldablePosture({
      width: 384,
      height: 854,
      platform: 'android',
      regions: EMPTY_REGIONS
    })
    expect(cover.posture).toBe('cover')
    expect(cover.isUnfoldedWorkbench).toBe(false)

    const landscapePhone = resolveFoldablePosture({
      width: 854,
      height: 384,
      platform: 'android',
      regions: EMPTY_REGIONS
    })
    expect(landscapePhone.posture).toBe('cover')
  })

  it('activates the 3-column unfolded workbench with hinge safe band on Magic V6 inner screen', () => {
    const unfolded = resolveFoldablePosture({
      width: 792,
      height: 836,
      platform: 'android',
      regions: {
        divisions: [{ x: 390, y: 0, width: 12, height: 836 }],
        hasFoldDivision: true,
        occlusions: [],
        foldPosture: 'flat',
        foldOrientation: 'vertical',
        foldSeparating: false
      }
    })
    expect(unfolded.posture).toBe('unfolded')
    expect(unfolded.isUnfoldedWorkbench).toBe(true)
    expect(unfolded.hingeAxis).toBe('vertical')
    expect(unfolded.hingeGap).toBe(12)
    expect(unfolded.hingeCenter).toBe(396)
    expect(unfolded.midPaneWidth).toBeGreaterThanOrEqual(248)
    expect(unfolded.midPaneWidth).toBeLessThanOrEqual(286)
  })

  it('activates Tabletop Mode when Jetpack WindowManager reports horizontal half-opened posture', () => {
    const tabletop = resolveFoldablePosture({
      width: 836,
      height: 792,
      platform: 'android',
      regions: {
        divisions: [{ x: 0, y: 400, width: 836, height: 16 }],
        hasFoldDivision: true,
        occlusions: [],
        foldPosture: 'half-opened',
        foldOrientation: 'horizontal',
        foldSeparating: true
      }
    })
    expect(tabletop.posture).toBe('tabletop')
    expect(tabletop.isTabletop).toBe(true)
    expect(tabletop.hingeAxis).toBe('horizontal')
    expect(tabletop.hingeGap).toBe(16)
    expect(tabletop.hingeCenter).toBe(408)
  })

  it('builds live stage routes and side-by-side auxiliary routes for split view', () => {
    const sessionTarget = {
      kind: 'session' as const,
      hostId: 'win-1',
      worktreeId: 'repo::/work',
      name: 'orca-custom',
      paneKey: 'tab-1:leaf-1'
    }
    expect(foldableStageKey(sessionTarget)).toBe('session:win-1:repo::/work')
    expect(buildFoldableStageRoute(sessionTarget)?.pathname).toBe(
      '/h/win-1/session/repo%3A%3A%2Fwork'
    )
    expect(buildFoldableAuxRoute(sessionTarget, 'diff')?.pathname).toBe(
      '/h/win-1/source-control/repo%3A%3A%2Fwork'
    )
    expect(buildFoldableAuxRoute(sessionTarget, 'files')?.pathname).toBe(
      '/h/win-1/files/repo%3A%3A%2Fwork'
    )
    expect(foldableStageHref(sessionTarget)).toContain('paneKey=tab-1%3Aleaf-1')

    const groupTarget = {
      kind: 'group' as const,
      hostId: 'win-1',
      groupId: 'grp-1',
      worktreeId: 'folder:grp-1',
      name: '风神开发团队'
    }
    expect(buildFoldableStageRoute(groupTarget)?.pathname).toBe('/h/win-1/group/grp-1')
    expect(buildFoldableAuxRoute(groupTarget, 'terminal')?.pathname).toBe(
      '/h/win-1/session/folder%3Agrp-1'
    )
    expect(buildFoldableAuxRoute(groupTarget, 'files')?.pathname).toBe(
      '/h/win-1/files/folder%3Agrp-1'
    )
  })
})
