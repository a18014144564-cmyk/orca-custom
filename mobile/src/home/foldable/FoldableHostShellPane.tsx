import { Component, memo, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { HostProtocolGate } from '../../components/host-connection/HostProtocolGate'
import { MobileDictationHostProvider } from '../../dictation/mobile-dictation-host'
import { MobileWebShellScreen } from '../../mobile-web-shell/MobileWebShellScreen'
import type { BridgeInitRoute } from '../../mobile-web-shell/bridge/protocol/bridge-init-route'
import { colors, radii, spacing } from '../../theme/mobile-theme'
import { themedStyleSheet } from '../../theme/themed-styles'

type BoundaryProps = {
  onOpenFullScreen?: () => void
  children: ReactNode
}

type BoundaryState = {
  failed: boolean
  message: string
}

class FoldableStageErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false, message: '' }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return {
      failed: true,
      message: error instanceof Error ? error.message : String(error)
    }
  }

  render() {
    if (!this.state.failed) {
      return this.props.children
    }
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorTitle}>该窗口加载遇到异常</Text>
        {this.state.message ? (
          <Text style={styles.errorDetail} numberOfLines={3}>
            {this.state.message}
          </Text>
        ) : null}
        <View style={styles.errorActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => this.setState({ failed: false, message: '' })}
            style={styles.retryBtn}
          >
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
          {this.props.onOpenFullScreen ? (
            <Pressable
              accessibilityRole="button"
              onPress={this.props.onOpenFullScreen}
              style={styles.fullBtn}
            >
              <Text style={styles.fullText}>独立窗口打开</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    )
  }
}

/**
 * Mounts MobileWebShellScreen safely inside the foldable workbench on the Home route by providing
 * the exact HostProtocolGate + MobileDictationHostProvider context tree that /h/_layout.tsx supplies.
 */
export const FoldableHostShellPane = memo(function FoldableHostShellPane(props: {
  shellKey: string
  hostId: string
  route: BridgeInitRoute
  onOpenFullScreen?: () => void
}) {
  return (
    <FoldableStageErrorBoundary
      key={props.shellKey}
      onOpenFullScreen={props.onOpenFullScreen}
    >
      <HostProtocolGate key={`gate:${props.hostId}`} hostId={props.hostId}>
        <MobileDictationHostProvider>
          <MobileWebShellScreen
            key={props.shellKey}
            hostId={props.hostId}
            route={props.route}
          />
        </MobileDictationHostProvider>
      </HostProtocolGate>
    </FoldableStageErrorBoundary>
  )
})

const styles = themedStyleSheet(() => ({
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.bgBase
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary
  },
  errorDetail: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 320
  },
  errorActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  retryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.control,
    backgroundColor: colors.accentBlue
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onAccent
  },
  fullBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  fullText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary
  }
}))
