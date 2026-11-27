import {
  Columns2,
  FileCode2,
  FolderOpen,
  GitCompareArrows,
  Maximize2,
  MessageSquare,
  PanelLeft,
  TerminalSquare
} from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { MobileWebShellScreen } from '../../mobile-web-shell/MobileWebShellScreen'
import { colors } from '../../theme/mobile-theme'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'
import {
  buildFoldableAuxRoute,
  buildFoldableStageRoute,
  foldableStageKey,
  type FoldableAuxMode,
  type FoldableStageTarget
} from './foldable-stage-types'
import { mobileFoldableStyles as styles } from './mobile-foldable-styles'

const AUX_TABS: readonly {
  id: FoldableAuxMode
  label: string
  icon: typeof GitCompareArrows
}[] = [
  { id: 'diff', label: 'Diff', icon: GitCompareArrows },
  { id: 'files', label: '文件', icon: FolderOpen },
  { id: 'review', label: '审查', icon: FileCode2 },
  { id: 'session', label: '双开', icon: TerminalSquare }
]

/** Unfolded right-hand workbench stage with live WebShell + 50/50 hinge-aware "左聊右看" split view. */
export function MobileFoldableStage(props: {
  target: FoldableStageTarget | null
  midCollapsed: boolean
  splitActive: boolean
  hingeGap: number
  onToggleMidCollapsed: () => void
  onToggleSplit: () => void
  onOpenFullScreen: (target: FoldableStageTarget) => void
}) {
  useMobileColorScheme()
  const { target, splitActive, hingeGap } = props
  const [auxMode, setAuxMode] = useState<FoldableAuxMode>('diff')

  const stageRoute = useMemo(
    () => (target ? buildFoldableStageRoute(target) : null),
    [target]
  )
  const auxRoute = useMemo(
    () => (target && target.kind === 'session' && splitActive ? buildFoldableAuxRoute(target, auxMode) : null),
    [auxMode, splitActive, target]
  )

  if (!target || !stageRoute) {
    return (
      <View style={styles.stageRoot}>
        <View style={styles.emptyStage}>
          <MessageSquare size={32} color={colors.textMuted} strokeWidth={1.6} />
          <Text style={styles.emptyStageTitle}>折叠屏工作台已就绪</Text>
          <Text style={styles.emptyStageBody}>
            点击左侧任意项目、最近单聊或 Bot 团队，右侧将原地实时打开；展开状态下还支持「左聊右看」双栏分屏看 Diff 与文件。
          </Text>
        </View>
      </View>
    )
  }

  const stageKey = foldableStageKey(target)
  const canSplit = target.kind === 'session'
  const showSplit = canSplit && splitActive && auxRoute != null

  return (
    <View style={styles.stageRoot}>
      <View style={styles.stageBar}>
        <View style={styles.stageTitleWrap}>
          <Text style={styles.stageTitle} numberOfLines={1}>
            {target.name}
          </Text>
        </View>

        <View style={styles.stageActions}>
          {!showSplit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={props.midCollapsed ? '展开左侧列表' : '收起左侧列表'}
              onPress={props.onToggleMidCollapsed}
              style={({ pressed }) => [
                styles.stageChip,
                props.midCollapsed && styles.stageChipActive,
                pressed && styles.railButtonPressed
              ]}
            >
              <PanelLeft
                size={13}
                color={props.midCollapsed ? colors.bgBase : colors.textSecondary}
              />
              <Text
                style={[styles.stageChipText, props.midCollapsed && styles.stageChipTextActive]}
              >
                {props.midCollapsed ? '展开列表' : '全屏'}
              </Text>
            </Pressable>
          ) : null}

          {canSplit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showSplit ? '退出左聊右看分屏' : '开启左聊右看折痕分屏'}
              onPress={props.onToggleSplit}
              style={({ pressed }) => [
                styles.stageChip,
                showSplit && styles.stageChipActive,
                pressed && styles.railButtonPressed
              ]}
            >
              <Columns2 size={13} color={showSplit ? colors.bgBase : colors.textSecondary} />
              <Text style={[styles.stageChipText, showSplit && styles.stageChipTextActive]}>
                {showSplit ? '退出分屏' : '左聊右看'}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="独立页面打开"
            onPress={() => props.onOpenFullScreen(target)}
            style={({ pressed }) => [styles.stageChip, pressed && styles.railButtonPressed]}
          >
            <Maximize2 size={13} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.stageBody}>
        <View style={styles.stagePane}>
          <MobileWebShellScreen key={stageKey} hostId={target.hostId} route={stageRoute} />
        </View>

        {showSplit ? (
          <>
            <View style={[styles.hingeDividerV, { width: Math.max(hingeGap, 12) }]}>
              <View style={styles.hingeHairlineV} />
            </View>
            <View style={styles.stagePane}>
              <View style={styles.auxTabBar}>
                {AUX_TABS.map((tab) => {
                  const Icon = tab.icon
                  const active = auxMode === tab.id
                  return (
                    <Pressable
                      key={tab.id}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      onPress={() => setAuxMode(tab.id)}
                      style={[styles.auxTab, active && styles.auxTabActive]}
                    >
                      <Icon
                        size={13}
                        color={active ? colors.textPrimary : colors.textMuted}
                      />
                      <Text style={[styles.auxTabText, active && styles.auxTabTextActive]}>
                        {tab.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
              <View style={styles.stagePane}>
                <MobileWebShellScreen
                  key={`${stageKey}:aux:${auxMode}`}
                  hostId={target.hostId}
                  route={auxRoute}
                />
              </View>
            </View>
          </>
        ) : null}
      </View>
    </View>
  )
}
