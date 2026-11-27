import {
  Columns2,
  FolderOpen,
  GitCompareArrows,
  Globe,
  MessageSquare,
  PanelLeft,
  PlusSquare,
  RefreshCw,
  SquareTerminal
} from 'lucide-react-native'
import { memo, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { colors } from '../../theme/mobile-theme'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'
import { FoldableBrowserPane } from './FoldableBrowserPane'
import { FoldableHostShellPane } from './FoldableHostShellPane'
import { FoldableSecondaryPicker } from './FoldableSecondaryPicker'
import {
  buildFoldableAuxRoute,
  buildFoldableStageRoute,
  foldableStageBadge,
  foldableStageKey,
  type FoldableAuxMode,
  type FoldableStageTarget
} from './foldable-stage-types'
import { mobileFoldableStyles as styles } from './mobile-foldable-styles'

const AUX_TABS: readonly {
  id: FoldableAuxMode
  label: string
  icon: typeof Globe
}[] = [
  { id: 'browser', label: '浏览器', icon: Globe },
  { id: 'terminal', label: '终端', icon: SquareTerminal },
  { id: 'files', label: '文件', icon: FolderOpen },
  { id: 'diff', label: 'Diff', icon: GitCompareArrows },
  { id: 'pick', label: '双开', icon: PlusSquare }
]

/** Unfolded Magic V6 stage: ANY chat (Team / Bot / Project) on the left + Browser / Terminal / Files / Diff / Second Chat on the right. */
export const MobileFoldableStage = memo(function MobileFoldableStage(props: {
  target: FoldableStageTarget | null
  secondaryCandidates: readonly FoldableStageTarget[]
  midCollapsed: boolean
  splitActive: boolean
  hingeGap: number
  onToggleMidCollapsed: () => void
  onToggleSplit: () => void
  onOpenFullScreen: (target: FoldableStageTarget) => void
}) {
  useMobileColorScheme()
  const { target, splitActive, hingeGap } = props
  const [auxMode, setAuxMode] = useState<FoldableAuxMode>('browser')
  const [browserMounted, setBrowserMounted] = useState(true)
  const [secondaryTarget, setSecondaryTarget] = useState<FoldableStageTarget | null>(null)

  const stageRoute = useMemo(
    () => (target ? buildFoldableStageRoute(target) : null),
    [target]
  )

  // Right-side Orca route for terminal / files / diff (works for Projects, Bots, AND Bot Teams via folderWorkspaceId).
  const auxRoute = useMemo(() => {
    if (!target || !splitActive) {
      return null
    }
    if (auxMode === 'terminal' || auxMode === 'files' || auxMode === 'diff') {
      return buildFoldableAuxRoute(target, auxMode)
    }
    if (auxMode === 'pick' && secondaryTarget) {
      return buildFoldableStageRoute(secondaryTarget)
    }
    return null
  }, [auxMode, secondaryTarget, splitActive, target])

  if (!target || !stageRoute) {
    return (
      <View style={styles.stageRoot}>
        <View style={styles.emptyStage}>
          <MessageSquare size={32} color={colors.textMuted} strokeWidth={1.6} />
          <Text style={styles.emptyStageTitle}>点左侧任意团队、Bot 或项目开始</Text>
          <Text style={styles.emptyStageBody}>
            打开后点右上角「左聊右看」，即可左边聊天、右边直接开浏览器、终端、文件或第二个窗口。
          </Text>
        </View>
      </View>
    )
  }

  const stageKey = foldableStageKey(target)
  const badge = foldableStageBadge(target)

  const renderNonBrowserAuxPane = () => {
    if (auxMode === 'browser') {
      return null
    }
    if (auxMode === 'pick') {
      if (!secondaryTarget || !auxRoute) {
        return (
          <FoldableSecondaryPicker
            candidates={props.secondaryCandidates}
            selected={secondaryTarget}
            onPick={setSecondaryTarget}
          />
        )
      }
      return (
        <View style={styles.stagePane}>
          <View style={styles.secondaryHeader}>
            <Text style={styles.secondaryTitle} numberOfLines={1}>
              {secondaryTarget.name}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSecondaryTarget(null)}
              style={styles.secondarySwitchBtn}
            >
              <RefreshCw size={12} color={colors.textSecondary} />
              <Text style={styles.secondarySwitchText}>更换窗口</Text>
            </Pressable>
          </View>
          <FoldableHostShellPane
            shellKey={`aux:pick:${foldableStageKey(secondaryTarget)}`}
            hostId={secondaryTarget.hostId}
            route={auxRoute}
            onOpenFullScreen={() => props.onOpenFullScreen(secondaryTarget)}
          />
        </View>
      )
    }
    if (!auxRoute) {
      return (
        <View style={styles.emptyStage}>
          <Text style={styles.emptyStageTitle}>当前窗口未绑定工作区</Text>
          <Text style={styles.emptyStageBody}>
            可以切到「浏览器」直接使用，或点「双开」在右侧选择任意项目终端。
          </Text>
        </View>
      )
    }
    return (
      <FoldableHostShellPane
        shellKey={`${stageKey}:aux:${auxMode}`}
        hostId={target.hostId}
        route={auxRoute}
        onOpenFullScreen={() => props.onOpenFullScreen(target)}
      />
    )
  }

  return (
    <View style={styles.stageRoot}>
      <View style={styles.stageBar}>
        <View style={styles.stageTitleWrap}>
          <View style={styles.stageKindBadge}>
            <Text style={styles.stageKindBadgeText}>{badge}</Text>
          </View>
          <Text style={styles.stageTitle} numberOfLines={1}>
            {target.name}
          </Text>
        </View>

        <View style={styles.stageActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.midCollapsed ? '展开列表' : '收起列表'}
            onPress={props.onToggleMidCollapsed}
            style={({ pressed }) => [styles.stageChip, pressed && styles.railButtonPressed]}
          >
            <PanelLeft size={13} color={colors.textSecondary} />
            <Text style={styles.stageChipText}>{props.midCollapsed ? '列表' : '收起'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={splitActive ? '退出左聊右看分屏' : '开启左聊右看分屏'}
            onPress={props.onToggleSplit}
            style={({ pressed }) => [
              styles.splitCta,
              splitActive && styles.splitCtaActive,
              pressed && styles.railButtonPressed
            ]}
          >
            <Columns2 size={14} color={splitActive ? colors.onAccent : colors.accentBlue} />
            <Text style={[styles.splitCtaText, splitActive && styles.splitCtaTextActive]}>
              {splitActive ? '退出分屏' : '左聊右看'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.stageBody}>
        <View style={styles.stagePane}>
          <FoldableHostShellPane
            shellKey={stageKey}
            hostId={target.hostId}
            route={stageRoute}
            onOpenFullScreen={() => props.onOpenFullScreen(target)}
          />
        </View>

        {splitActive ? (
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
                      onPress={() => {
                        setAuxMode(tab.id)
                        if (tab.id === 'browser' && !browserMounted) {
                          setBrowserMounted(true)
                        }
                      }}
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
                {browserMounted ? (
                  <View style={auxMode === 'browser' ? styles.fill : styles.hidden}>
                    <FoldableBrowserPane />
                  </View>
                ) : null}
                {auxMode !== 'browser' ? renderNonBrowserAuxPane() : null}
              </View>
            </View>
          </>
        ) : null}
      </View>
    </View>
  )
})
