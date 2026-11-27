import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, useWindowDimensions } from 'react-native'
import {
  resolveFoldablePosture,
  type FoldablePostureMetrics
} from './foldable-posture-model'
import { useReservedRegions } from './reserved-regions'

export * from './foldable-posture-model'

export const FOLDABLE_RAIL_THUMB_STORAGE_KEY = 'orca.custom.foldableRailThumbBottom'

export function useFoldablePosture(): FoldablePostureMetrics {
  const { width, height } = useWindowDimensions()
  const regions = useReservedRegions()
  return useMemo(
    () =>
      resolveFoldablePosture({
        width,
        height,
        platform: Platform.OS,
        regions
      }),
    [height, regions, width]
  )
}

export function useFoldableRailThumbBottom(): {
  thumbBottom: boolean
  toggleThumbBottom: () => void
} {
  const [thumbBottom, setThumbBottom] = useState(true)

  useEffect(() => {
    let active = true
    void AsyncStorage.getItem(FOLDABLE_RAIL_THUMB_STORAGE_KEY)
      .then((raw) => {
        if (!active || raw == null) {
          return
        }
        setThumbBottom(raw !== 'false')
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const toggleThumbBottom = useCallback(() => {
    setThumbBottom((prev) => {
      const next = !prev
      void AsyncStorage.setItem(FOLDABLE_RAIL_THUMB_STORAGE_KEY, String(next)).catch(() => {})
      return next
    })
  }, [])

  return { thumbBottom, toggleThumbBottom }
}
