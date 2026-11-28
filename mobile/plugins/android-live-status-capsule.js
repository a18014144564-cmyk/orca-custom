const { withAndroidManifest } = require('expo/config-plugins')

const PROMOTED_NOTIFICATIONS_PERMISSION = 'android.permission.POST_PROMOTED_NOTIFICATIONS'

/**
 * Declares Android 16 (API 36+) POST_PROMOTED_NOTIFICATIONS so Honor MagicOS 10 / Android 16+
 * can promote Orca's ongoing live-status notification into a status-bar Live Update capsule chip,
 * while older Android / MagicOS builds cleanly fall back to a sticky lockscreen/status-bar card.
 */
module.exports = function withAndroidLiveStatusCapsule(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest
    const list = manifest['uses-permission'] ?? []
    const exists = list.some(
      (entry) => entry?.$?.['android:name'] === PROMOTED_NOTIFICATIONS_PERMISSION
    )
    if (!exists) {
      list.push({ $: { 'android:name': PROMOTED_NOTIFICATIONS_PERMISSION } })
      manifest['uses-permission'] = list
    }
    return cfg
  })
}
