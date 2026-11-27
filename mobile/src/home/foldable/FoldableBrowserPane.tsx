import { ArrowRight, ChevronLeft, ChevronRight, Globe, RotateCw } from 'lucide-react-native'
import { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { colors, radii, spacing } from '../../theme/mobile-theme'
import { themedStyleSheet } from '../../theme/themed-styles'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'

const QUICK_LINKS: readonly { label: string; url: string }[] = [
  { label: 'GitHub', url: 'https://github.com' },
  { label: '本地 3000', url: 'http://192.168.31.67:3000' },
  { label: '本地 5173', url: 'http://192.168.31.67:5173' },
  { label: 'Mac 3000', url: 'http://192.168.31.125:3000' }
]

function normalizeInputUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  if (/^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(trimmed)) {
    return `http://${trimmed}`
  }
  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    return `https://${trimmed}`
  }
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
}

/** Native embedded browser for the right half of Magic V6 "左聊右看" split view. */
export function FoldableBrowserPane() {
  useMobileColorScheme()
  const webRef = useRef<WebView>(null)
  const [url, setUrl] = useState<string>('')
  const [draft, setDraft] = useState<string>('')
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)

  const navigate = (raw: string) => {
    const normalized = normalizeInputUrl(raw)
    if (!normalized) {
      return
    }
    setUrl(normalized)
    setDraft(normalized)
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="后退"
          disabled={!canGoBack}
          onPress={() => webRef.current?.goBack()}
          style={[styles.iconBtn, !canGoBack && styles.iconBtnDisabled]}
        >
          <ChevronLeft size={16} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="前进"
          disabled={!canGoForward}
          onPress={() => webRef.current?.goForward()}
          style={[styles.iconBtn, !canGoForward && styles.iconBtnDisabled]}
        >
          <ChevronRight size={16} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="刷新"
          disabled={!url}
          onPress={() => webRef.current?.reload()}
          style={[styles.iconBtn, !url && styles.iconBtnDisabled]}
        >
          <RotateCw size={14} color={colors.textSecondary} />
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => navigate(draft)}
          placeholder="输入网址或内网调试地址 (如 192.168.31.67:3000)"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          selectTextOnFocus
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="前往"
          onPress={() => navigate(draft)}
          style={styles.goBtn}
        >
          <ArrowRight size={14} color={colors.onAccent} />
        </Pressable>
      </View>

      {url ? (
        <WebView
          ref={webRef}
          source={{ uri: url }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          onNavigationStateChange={(nav) => {
            setCanGoBack(nav.canGoBack)
            setCanGoForward(nav.canGoForward)
            if (nav.url) {
              setDraft(nav.url)
            }
          }}
        />
      ) : (
        <View style={styles.landing}>
          <Globe size={28} color={colors.textMuted} strokeWidth={1.6} />
          <Text style={styles.landingTitle}>右屏浏览器</Text>
          <Text style={styles.landingBody}>
            左侧可随意切团队 / 单独 Bot / 项目聊天，右侧独立浏览网页、文档或电脑本地预览服务。
          </Text>
          <View style={styles.presetRow}>
            {QUICK_LINKS.map((item) => (
              <Pressable
                key={item.url}
                accessibilityRole="button"
                onPress={() => navigate(item.url)}
                style={({ pressed }) => [styles.presetChip, pressed && styles.presetPressed]}
              >
                <Text style={styles.presetText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

const styles = themedStyleSheet(() => ({
  root: { flex: 1, backgroundColor: colors.bgBase },
  toolbar: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconBtnDisabled: { opacity: 0.35 },
  input: {
    flex: 1,
    height: 28,
    borderRadius: radii.control,
    backgroundColor: colors.bgBase,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.sm,
    fontSize: 12.5,
    color: colors.textPrimary
  },
  goBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.control,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center'
  },
  webview: { flex: 1, backgroundColor: colors.bgBase },
  landing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm
  },
  landingTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  landingBody: {
    fontSize: 12.5,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.xs
  },
  presetChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  presetPressed: { opacity: 0.7 },
  presetText: { fontSize: 12, fontWeight: '500', color: colors.textPrimary }
}))
