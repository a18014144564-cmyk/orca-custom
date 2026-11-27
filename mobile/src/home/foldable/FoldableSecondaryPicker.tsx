import { Bot, Folder, Users } from 'lucide-react-native'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing } from '../../theme/mobile-theme'
import { themedStyleSheet } from '../../theme/themed-styles'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'
import {
  foldableStageBadge,
  foldableStageKey,
  type FoldableStageTarget
} from './foldable-stage-types'

/** Quick picker rendered inside the right split pane so user can open any second Team / Bot / Project. */
export function FoldableSecondaryPicker(props: {
  candidates: readonly FoldableStageTarget[]
  selected: FoldableStageTarget | null
  onPick: (target: FoldableStageTarget) => void
}) {
  useMobileColorScheme()
  const selectedKey = props.selected ? foldableStageKey(props.selected) : null

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Text style={styles.hint}>选择要在右侧打开的项目、Bot 或团队（左侧聊天保持不动）：</Text>
      {props.candidates.length === 0 ? (
        <Text style={styles.empty}>暂无可双开的已连接主机窗口</Text>
      ) : (
        props.candidates.map((item) => {
          const key = foldableStageKey(item)
          const active = key === selectedKey
          const Icon =
            item.kind === 'group' ? Users : item.source === 'bot' ? Bot : Folder
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => props.onPick(item)}
              style={({ pressed }) => [
                styles.row,
                active && styles.rowActive,
                pressed && styles.rowPressed
              ]}
            >
              <Icon size={15} color={active ? colors.accentBlue : colors.textMuted} />
              <Text style={styles.title} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{foldableStageBadge(item)}</Text>
              </View>
            </Pressable>
          )
        })
      )}
    </ScrollView>
  )
}

const styles = themedStyleSheet(() => ({
  list: { padding: spacing.md, gap: spacing.xs + 2 },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  empty: { fontSize: 13, color: colors.textMuted, paddingVertical: spacing.lg, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.bgPanel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  rowActive: { borderColor: colors.accentBlue },
  rowPressed: { opacity: 0.7 },
  title: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.bgBase
  },
  tagText: { fontSize: 11, color: colors.textSecondary }
}))
