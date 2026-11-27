import {
  Activity,
  Bot,
  Columns2,
  FolderGit2,
  Gauge,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  type LucideIcon
} from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'
import { colors } from '../../theme/mobile-theme'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'
import {
  buildFiveSlotMobileTabs,
  type FiveSlotHomeTabId,
  type FourZoneHomeTabId,
  type HomeTabId
} from '../tabs/home-tabs'
import { mobileFoldableStyles as styles } from './mobile-foldable-styles'

const RAIL_ICONS: Record<FiveSlotHomeTabId, LucideIcon> = {
  teams: Users,
  bots: Bot,
  running: Activity,
  projects: FolderGit2,
  usage: Gauge
}

const RAIL_LABELS: Record<FiveSlotHomeTabId, string> = {
  teams: 'Bot 团队',
  bots: '单独 Bot',
  running: '运行中',
  projects: '项目',
  usage: '使用情况'
}

/** Simplified 54dp left AppRail for unfolded Honor Magic V6: 4 zones + center Running hub + 1-tap Split + List toggle + Settings. */
export function MobileFoldableRail(props: {
  tabs: readonly FourZoneHomeTabId[]
  active: HomeTabId
  midCollapsed: boolean
  splitActive: boolean
  teamsBadge: number
  botsBadge: number
  projectsBadge: number
  runningBadge: number
  onSelect: (tab: FiveSlotHomeTabId) => void
  onLongPressTab: (tab: FourZoneHomeTabId) => void
  onToggleSplit: () => void
  onToggleMidCollapsed: () => void
  onOpenSettings: () => void
}) {
  useMobileColorScheme()
  const orderedSlots = buildFiveSlotMobileTabs(props.tabs)
  const badges: Record<FiveSlotHomeTabId, number> = {
    teams: props.teamsBadge,
    bots: props.botsBadge,
    running: props.runningBadge,
    projects: props.projectsBadge,
    usage: 0
  }

  return (
    <View style={styles.rail} accessibilityRole="tablist">
      <View style={styles.railGroup}>
        {orderedSlots.map((id) => {
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
              onLongPress={id === 'running' ? undefined : () => props.onLongPressTab(id)}
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
        })}
      </View>

      <View style={styles.railGroup}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.splitActive ? '退出左聊右看分屏' : '开启左聊右看分屏'}
          accessibilityState={{ selected: props.splitActive }}
          onPress={props.onToggleSplit}
          style={({ pressed }) => [
            styles.railButton,
            props.splitActive && styles.railSplitActive,
            pressed && styles.railButtonPressed
          ]}
        >
          <Columns2
            size={19}
            color={props.splitActive ? colors.onAccent : colors.textSecondary}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.midCollapsed ? '展开列表栏' : '收起列表栏'}
          onPress={props.onToggleMidCollapsed}
          style={({ pressed }) => [styles.railButton, pressed && styles.railButtonPressed]}
        >
          {props.midCollapsed ? (
            <PanelLeftOpen size={18} color={colors.textMuted} />
          ) : (
            <PanelLeftClose size={18} color={colors.textMuted} />
          )}
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
