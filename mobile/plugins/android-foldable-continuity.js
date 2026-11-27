const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins')

const REQUIRED_CONFIG_CHANGES = [
  'keyboard',
  'keyboardHidden',
  'orientation',
  'screenSize',
  'smallestScreenSize',
  'screenLayout',
  'uiMode',
  'density'
]

/**
 * Ensures Android foldable posture transitions (e.g. Honor Magic V6 cover <-> unfolded inner screen)
 * keep MainActivity alive without destroying WebViews, live RPC connections, or message drafts.
 */
module.exports = function withAndroidFoldableContinuity(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults)
    activity.$['android:resizeableActivity'] = 'true'
    const existing = (activity.$['android:configChanges'] ?? '').split('|').filter(Boolean)
    const merged = [...existing]
    for (const flag of REQUIRED_CONFIG_CHANGES) {
      if (!merged.includes(flag)) {
        merged.push(flag)
      }
    }
    activity.$['android:configChanges'] = merged.join('|')
    return cfg
  })
}
