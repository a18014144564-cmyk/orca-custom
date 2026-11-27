import { StyleSheet } from 'react-native'
import { colors, radii, spacing } from '../../theme/mobile-theme'
import { themedStyleSheet } from '../../theme/themed-styles'

export const mobileFoldableStyles = themedStyleSheet(() => ({
  workbenchRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.bgBase
  },
  rail: {
    width: 54,
    backgroundColor: colors.bgPanel,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm
  },
  railGroup: {
    alignItems: 'center',
    gap: 8
  },
  railButton: {
    width: 40,
    height: 40,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center'
  },
  railButtonActive: {
    backgroundColor: colors.bgBase,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  railSplitActive: {
    backgroundColor: colors.accentBlue
  },
  railButtonPressed: { opacity: 0.7 },
  railBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.statusAmber,
    alignItems: 'center',
    justifyContent: 'center'
  },
  railBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#000'
  },
  railDivider: { width: 24, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSubtle, marginVertical: 2 },
  midPane: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.borderSubtle, backgroundColor: colors.bgBase },
  stageRoot: { flex: 1, minWidth: 0, backgroundColor: colors.bgBase },
  stageBar: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel,
    gap: spacing.sm
  },
  stageTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  stageKindBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.bgBase,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  stageKindBadgeText: { fontSize: 10.5, fontWeight: '600', color: colors.textSecondary },
  stageTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  stageActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stageChip: {
    height: 28,
    paddingHorizontal: 9,
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgBase,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  stageChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  splitCta: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.accentBlue,
    backgroundColor: colors.bgBase,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  splitCtaActive: { backgroundColor: colors.accentBlue },
  splitCtaText: { fontSize: 12, fontWeight: '600', color: colors.accentBlue },
  splitCtaTextActive: { color: colors.onAccent },
  secondaryHeader: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.bgBase
  },
  secondaryTitle: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  secondarySwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.bgPanel
  },
  secondarySwitchText: { fontSize: 11, fontWeight: '500', color: colors.textSecondary },
  stageBody: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0
  },
  stagePane: {
    flex: 1,
    minWidth: 0,
    minHeight: 0
  },
  hingeDividerV: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgPanel
  },
  hingeHairlineV: {
    width: StyleSheet.hairlineWidth,
    height: '100%',
    backgroundColor: colors.borderSubtle
  },
  auxTabBar: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  auxTab: {
    height: 26,
    paddingHorizontal: 9,
    borderRadius: radii.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center'
  },
  auxTabActive: {
    backgroundColor: colors.bgBase,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  auxTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textMuted
  },
  auxTabTextActive: {
    color: colors.textPrimary
  },
  emptyStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm
  },
  emptyStageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary
  },
  emptyStageBody: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 19
  },
  // Tabletop mode
  tabletopRoot: { flex: 1, flexDirection: 'column', backgroundColor: colors.bgBase },
  tabletopTop: { minHeight: 0, overflow: 'hidden', backgroundColor: colors.bgBase },
  tabletopHinge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgPanel,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  tabletopBottom: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.bgPanel,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm
  },
  tabletopHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabletopTitle: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabletopAgentStrip: { flexDirection: 'row', gap: spacing.xs },
  tabletopAgentChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgBase,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 210
  },
  tabletopAgentChipActive: { borderColor: colors.accentBlue },
  tabletopAgentText: { fontSize: 12.5, fontWeight: '500', color: colors.textPrimary },
  tabletopActionsRow: { flex: 1, flexDirection: 'row', gap: spacing.sm },
  tabletopTile: {
    flex: 1,
    borderRadius: radii.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    gap: 5
  },
  tabletopTilePrimary: { backgroundColor: colors.accentBlue, borderColor: colors.accentBlue },
  tabletopTileLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  tabletopTileLabelPrimary: { color: colors.onAccent },
  tabletopTileHint: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  tabletopTileHintPrimary: { color: colors.onAccent, opacity: 0.85 },
  statusDotSmall: { width: 7, height: 7, borderRadius: radii.pill }
}))
