import { StyleSheet } from 'react-native'
import { colors, radii, spacing } from '../../theme/mobile-theme'
import { themedStyleSheet } from '../../theme/themed-styles'

export const mobileRunningStyles = themedStyleSheet(() => ({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, gap: spacing.sm },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    gap: spacing.sm
  },
  statusSummary: { fontSize: 12.5, fontWeight: '500', color: colors.textSecondary, flex: 1 },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.bgPanel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  clearBtnPressed: { opacity: 0.7 },
  clearBtnText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  timeoutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.bgPanel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  timeoutPillText: { fontSize: 11.5, fontWeight: '600', color: colors.textSecondary },
  card: {
    backgroundColor: colors.bgPanel,
    borderRadius: radii.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: 6
  },
  cardSelected: {
    borderColor: '#3b82f6',
    borderWidth: 1.5,
    backgroundColor: 'rgba(59, 130, 246, 0.14)'
  },
  cardPressed: { opacity: 0.78 },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs
  },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  deviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    maxWidth: 165
  },
  deviceBadgeWin: { backgroundColor: 'rgba(59, 130, 246, 0.16)' },
  deviceBadgeMac: { backgroundColor: 'rgba(168, 85, 247, 0.16)' },
  deviceBadgeOther: { backgroundColor: 'rgba(16, 185, 129, 0.16)' },
  deviceBadgeTextWin: { fontSize: 11, fontWeight: '600', color: '#60a5fa' },
  deviceBadgeTextMac: { fontSize: 11, fontWeight: '600', color: '#c084fc' },
  deviceBadgeTextOther: { fontSize: 11, fontWeight: '600', color: '#34d399' },
  kindBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.bgBase
  },
  kindBadgeText: { fontSize: 10.5, fontWeight: '500', color: colors.textMuted },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill
  },
  statusChipWorking: { backgroundColor: 'rgba(245, 158, 11, 0.16)' },
  statusChipAttention: { backgroundColor: 'rgba(239, 68, 68, 0.16)' },
  statusChipIdle: { backgroundColor: colors.bgBase },
  statusDot: { width: 6, height: 6, borderRadius: radii.pill },
  statusTextWorking: { fontSize: 11, fontWeight: '600', color: colors.statusAmber },
  statusTextAttention: { fontSize: 11, fontWeight: '600', color: colors.statusRed },
  statusTextIdle: { fontSize: 11, fontWeight: '500', color: colors.textMuted },
  cardTitle: { fontSize: 14.5, fontWeight: '600', color: colors.textPrimary },
  cardSubtitle: { fontSize: 12.5, color: colors.textSecondary },
  deviceSection: { gap: spacing.xs + 2, marginBottom: spacing.xs },
  deviceSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs
  },
  deviceSectionTitle: { fontSize: 12.5, fontWeight: '600', color: colors.textSecondary },
  deviceSectionCount: { fontSize: 11.5, color: colors.textMuted },
  emptyWrap: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' }
}))
