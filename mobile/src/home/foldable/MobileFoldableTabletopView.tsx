import { Maximize2, Monitor, Plus, TabletSmartphone } from 'lucide-react-native'
import { useMemo } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import type { AgentListRow } from '../../agents/agent-list-rows'
import { colors } from '../../theme/mobile-theme'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'
import { FoldableHostShellPane } from './FoldableHostShellPane'
import {
  buildFoldableStageRoute,
  foldableStageKey,
  type FoldableStageTarget
} from './foldable-stage-types'
import { mobileFoldableStyles as styles } from './mobile-foldable-styles'

/** Honor Magic V6 horizontal half-folded Tabletop Mode: live monitor on top half, ergonomic deck on bottom half. */
export function MobileFoldableTabletopView(props: {
  target: FoldableStageTarget | null
  activeAgents: readonly AgentListRow[]
  hingeCenter: number | null
  screenHeight: number
  hingeGap: number
  onSelectAgent: (row: AgentListRow) => void
  onOpenFullScreen: (target: FoldableStageTarget) => void
  onNewWorkspace: () => void
  onExitTabletop: () => void
}) {
  useMobileColorScheme()
  const { target, activeAgents, hingeCenter, screenHeight, hingeGap } = props
  const stageRoute = useMemo(
    () => (target ? buildFoldableStageRoute(target) : null),
    [target]
  )
  const topHeight =
    hingeCenter != null && hingeCenter > 160 && hingeCenter < screenHeight - 180
      ? Math.round(hingeCenter - hingeGap / 2)
      : Math.round(screenHeight * 0.54)

  return (
    <View style={styles.tabletopRoot}>
      <View style={[styles.tabletopTop, { height: topHeight }]}>
        {target && stageRoute ? (
          <FoldableHostShellPane
            shellKey={`tt:${foldableStageKey(target)}`}
            hostId={target.hostId}
            route={stageRoute}
            onOpenFullScreen={() => props.onOpenFullScreen(target)}
          />
        ) : (
          <View style={styles.emptyStage}>
            <Monitor size={30} color={colors.textMuted} strokeWidth={1.6} />
            <Text style={styles.emptyStageTitle}>半折悬停监控台</Text>
            <Text style={styles.emptyStageBody}>
              从下方点选任意运行中的对话，上半屏实时监控输出，下半屏单手操控。
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.tabletopHinge, { height: Math.max(hingeGap, 12) }]} />

      <View style={styles.tabletopBottom}>
        <View style={styles.tabletopHeader}>
          <Text style={styles.tabletopTitle} numberOfLines={1}>
            {target ? `悬停监控 · ${target.name}` : '悬停控制台'}
          </Text>
          <Text style={styles.tabletopTileHint}>
            {activeAgents.length > 0 ? `${activeAgents.length} 个进行中单聊` : '暂无进行中单聊'}
          </Text>
        </View>

        {activeAgents.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabletopAgentStrip}
          >
            {activeAgents.slice(0, 8).map((row) => {
              const selected =
                target?.kind === 'session' &&
                target.hostId === row.hostId &&
                target.worktreeId === row.entry.worktreeId
              const dotColor =
                row.dotState === 'working' || row.dotState === 'monitoring'
                  ? colors.statusAmber
                  : colors.statusGreen
              return (
                <Pressable
                  key={row.key}
                  accessibilityRole="button"
                  onPress={() => props.onSelectAgent(row)}
                  style={[styles.tabletopAgentChip, selected && styles.tabletopAgentChipActive]}
                >
                  <View style={[styles.statusDotSmall, { backgroundColor: dotColor }]} />
                  <Text style={styles.tabletopAgentText} numberOfLines={1}>
                    {row.title}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        ) : null}

        <View style={styles.tabletopActionsRow}>
          {target ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => props.onOpenFullScreen(target)}
              style={({ pressed }) => [
                styles.tabletopTile,
                styles.tabletopTilePrimary,
                pressed && styles.railButtonPressed
              ]}
            >
              <Maximize2 size={18} color={colors.onAccent} />
              <Text style={[styles.tabletopTileLabel, styles.tabletopTileLabelPrimary]}>
                进入交互
              </Text>
              <Text style={[styles.tabletopTileHint, styles.tabletopTileHintPrimary]}>
                审批或语音输入
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={props.onNewWorkspace}
            style={({ pressed }) => [styles.tabletopTile, pressed && styles.railButtonPressed]}
          >
            <Plus size={18} color={colors.textPrimary} />
            <Text style={styles.tabletopTileLabel}>新建对话</Text>
            <Text style={styles.tabletopTileHint}>在已连主机发起</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={props.onExitTabletop}
            style={({ pressed }) => [styles.tabletopTile, pressed && styles.railButtonPressed]}
          >
            <TabletSmartphone size={18} color={colors.textPrimary} />
            <Text style={styles.tabletopTileLabel}>切回工作台</Text>
            <Text style={styles.tabletopTileHint}>三栏展开视图</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
