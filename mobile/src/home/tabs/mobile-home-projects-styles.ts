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
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs + 2
  },
  sectionHeaderFirst: {
    paddingTop: spacing.xs
  },
  sectionHeaderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  sectionHeaderTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.2
  },
  filterButton: {
    width: 28,
    height: 28,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterButtonActive: {
    backgroundColor: colors.bgRaised
  },
  codexProjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md
  },
  expandButton: {
    width: 22,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2
  },
  expandSpacer: {
    width: 24
  },
  codexProjectMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10
  },
  rowPressed: {
    opacity: 0.65
  },
  markWrap: {
    position: 'relative',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  markWrapSmall: {
    position: 'relative',
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cornerDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.bgPanel
  },
  codexProjectTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary
  },
  codexTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  tabCountPill: {
    minWidth: 20,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.bgRaised,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    fontVariant: ['tabular-nums']
  },
  branchList: {
    marginLeft: 38,
    marginRight: spacing.md,
    marginBottom: spacing.xs + 2,
    paddingLeft: spacing.sm,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.borderSubtle,
    gap: 2
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: spacing.xs
  },
  branchLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary
  },
  branchDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill
  },
  codexRecentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: 9
  },
  codexRecentTitle: {
    flex: 1,
    fontSize: 14.5,
    color: colors.textPrimary
  },
  codexRecentTime: {
    fontSize: 12,
    color: colors.textMuted,
    fontVariant: ['tabular-nums']
  },
  recentEmptyText: {
    fontSize: 13,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  showMoreRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignItems: 'center'
  },
  showMoreText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: colors.textSecondary
  }
}))
