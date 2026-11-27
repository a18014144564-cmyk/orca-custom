import {
  ArrowDownToLine,
  ArrowUpToLine,
  Bot,
  FolderGit2,
  Gauge,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  type LucideIcon
} from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'
import { colors } from '../../theme/mobile-theme'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'
import type { FourZoneHomeTabId, HomeTabId } from '../tabs/home-tabs'
import { mobileFoldableStyles as styles } from './mobile-foldable-styles'

const RAIL_ICONS: Record<FourZoneHomeTabId, LucideIcon> = {
  teams: Users,
  bots: Bot,
  projects: FolderGit2,
  usage: Gauge
}

const RAIL_LABELS: Record<FourZoneHomeTabId, string> = {
  teams: 'Bot 团队',
  bots: '单独 Bot',
  projects: '项目',
  usage: '使用情况'
}

/** 54dp left AppRail for unfolded Honor Magic V6, with thumb-zone bottom alignment and long-press reorder. */
export function MobileFoldableRail(props: {
  tabs: readonly FourZoneHomeTabId[]
  active: HomeTabId
  thumbBottom: boolean
  midCollapsed: boolean
  teamsBadge: number
  botsBadge: number
  projectsBadge: number
  onSelect: (tab: FourZoneHomeTabId) => void
  onLongPressTab: (tab: FourZoneHomeTabId) => void
  onToggleThumbBottom: () => void
  onToggleMidCollapsed: () => void
  onToggleClassicLayout: () => void
  onOpenSettings: () => void
}) {
  useMobileColorScheme()
  const badges: Record<FourZoneHomeTabId, number> = {
    teams: props.teamsBadge,
    bots: props.botsBadge,
    projects: props.projectsBadge,
    usage: 0
  }

  const zoneButtons = props.tabs.map((id) => {
    const Icon = RAIL_ICONS[id]
    const active = props.active === id
    const badge = badges[id]
    return (
      <Pressable
        key={id}
        accessibilityRole="tab"
        accessibilityLabel={RAIL_LABELS[id]}
        accessibilityState={{ selected: active }}
        onPress={() => props.onSelect(id)}
        onLongPress={() => props.onLongPressTab(id)}
        style={({ pressed }) => [
          styles.railButton,
          active && styles.railButtonActive,
          pressed && styles.railButtonPressed
        ]}
      >
        <Icon
          size={21}
          strokeWidth={active ? 2.2 : 1.8}
          color={active ? colors.textPrimary : colors.textMuted}
        />
        {badge > 0 ? (
          <View style={styles.railBadge} pointerEvents="none">
            <Text style={styles.railBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </Pressable>
    )
  })

  const thumbAlignButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.thumbBottom ? '切换图标靠上对齐' : '切换图标靠下对齐（护拇指）'}
      onPress={props.onToggleThumbBottom}
      style={({ pressed }) => [styles.railButton, pressed && styles.railButtonPressed]}
    >
      {props.thumbBottom ? (
        <ArrowDownToLine size={17} color={colors.textMuted} />
      ) : (
        <ArrowUpToLine size={17} color={colors.textMuted} />
      )}
    </Pressable>
  )

  return (
    <View style={styles.rail} accessibilityRole="tablist">
      <View style={styles.railGroup}>
        {thumbAlignButton}
        {!props.thumbBottom ? zoneButtons : null}
      </View>

      <View style={styles.railGroup}>
        {props.thumbBottom ? zoneButtons : null}
        <View style={styles.railDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.midCollapsed ? '展开列表栏' : '收起列表栏'}
          onPress={props.onToggleMidCollapsed}
          style={({ pressed }) => [styles.railButton, pressed && styles.railButtonPressed]}
        >
          {props.midCollapsed ? (
            <PanelLeftOpen size={19} color={colors.textSecondary} />
          ) : (
            <PanelLeftClose size={19} color={colors.textSecondary} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="切换经典视图"
          onPress={props.onToggleClassicLayout}
          style={({ pressed }) => [styles.railButton, pressed && styles.railButtonPressed]}
        >
          <LayoutGrid size={18} color={colors.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="设置"
          onPress={props.onOpenSettings}
          style={({ pressed }) => [styles.railButton, pressed && styles.railButtonPressed]}
        >
          <Settings size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  )
}
