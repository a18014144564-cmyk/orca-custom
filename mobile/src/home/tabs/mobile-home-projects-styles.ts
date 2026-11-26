import { StyleSheet } from 'react-native'
import { colors, radii, spacing } from '../../theme/mobile-theme'
import { themedStyleSheet } from '../../theme/themed-styles'

export const mobileHomeProjectsStyles = themedStyleSheet(() => ({
  screen: { flex: 1 },
  swipeArea: { flex: 1 },
  switcherWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm
  },
  switcherTrack: {
    flexDirection: 'row',
    backgroundColor: colors.bgPanel,
    borderRadius: radii.surface,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  segment: {
    flex: 1,
    minHeight: 38,
    borderRadius: radii.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: spacing.sm
  },
  segmentSelected: {
    backgroundColor: colors.bgBase,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1
  },
  segmentPressed: { opacity: 0.8 },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted
  },
  segmentLabelSelected: {
    color: colors.textPrimary
  },
  countPill: {
    minWidth: 20,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgRaised
  },
  countPillSelected: {
    backgroundColor: colors.bgPanel
  },
  countText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    fontVariant: ['tabular-nums']
  },
  countTextSelected: {
    color: colors.textSecondary
  },
  content: { paddingHorizontal: spacing.lg },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xl
  },
  pairButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentBlue,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill
  },
  pairButtonPressed: { opacity: 0.85 },
  pairButtonText: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '600'
  },
  rowStatusDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill
  },
  rowStatusDotIdle: {
    opacity: 0.45
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1
  },
  branchIcon: {
    marginTop: 1
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.accentBlue
  }
}))
