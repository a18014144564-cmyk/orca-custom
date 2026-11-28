import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

const LIVE_STATUS_CHANNEL_ID = 'orca-live-status'
const LIVE_STATUS_NOTIFICATION_ID = 'orca-live-running-capsule'

export type LiveStatusCapsuleSummary = Readonly<{
  activeCount: number
  attentionCount: number
  topTitle: string
  topDevice: string
}>

let channelReady = false
let lastSignature = ''

async function ensureLiveStatusChannel(): Promise<void> {
  if (channelReady || Platform.OS !== 'android') {
    return
  }
  channelReady = true
  await Notifications.setNotificationChannelAsync(LIVE_STATUS_CHANNEL_ID, {
    name: 'Orca 实时运行胶囊',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
    showBadge: false
  }).catch(() => {
    channelReady = false
  })
}

/**
 * Keeps a single silent sticky Android ongoing notification synced with active cross-device
 * running windows (promoted to a status-bar Live Update capsule on Android 16 / Honor MagicOS 10
 * when permitted, and displayed as a pinned lockscreen/shade live status card on all Android builds).
 * No-ops on iOS to preserve single-target IPA compatibility with Free Apple ID + LiveContainer.
 */
export async function syncAndroidLiveStatusCapsule(summary: LiveStatusCapsuleSummary): Promise<void> {
  if (Platform.OS !== 'android') {
    return
  }
  if (summary.activeCount <= 0) {
    if (lastSignature === '') {
      return
    }
    lastSignature = ''
    await Notifications.dismissNotificationAsync(LIVE_STATUS_NOTIFICATION_ID).catch(() => undefined)
    return
  }

  const title =
    summary.attentionCount > 0
      ? `Orca 待审批 (${summary.attentionCount}) · 共 ${summary.activeCount} 个运行中`
      : `Orca 运行中 · ${summary.activeCount} 个窗口`
  const body = summary.topDevice
    ? `${summary.topDevice} · ${summary.topTitle}`
    : summary.topTitle || '点击查看当前运行的窗口'
  const signature = `${title}\n${body}`
  if (signature === lastSignature) {
    return
  }

  try {
    const perms = await Notifications.getPermissionsAsync()
    if (perms.status !== 'granted') {
      return
    }
    await ensureLiveStatusChannel()
    lastSignature = signature
    await Notifications.scheduleNotificationAsync({
      identifier: LIVE_STATUS_NOTIFICATION_ID,
      content: {
        title,
        body,
        sticky: true,
        autoDismiss: false,
        sound: false,
        priority: Notifications.AndroidNotificationPriority.LOW,
        data: { type: 'orca-live-capsule' }
      },
      trigger: { channelId: LIVE_STATUS_CHANNEL_ID }
    })
  } catch {
    // Non-fatal: older Android builds or denied permissions simply skip the live capsule.
  }
}
