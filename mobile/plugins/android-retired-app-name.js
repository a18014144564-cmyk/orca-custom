const { AndroidConfig, withStringsXml } = require('expo/config-plugins')

// Why: the new app (dev.orca.app) installs next to this one, so the old GitHub app's launcher
// label says which icon the move screen's "Delete this app" step means. iOS keeps its name.
const RETIRED_ANDROID_PACKAGE = 'com.stably.orca.mobile'
const RETIRED_APP_LABEL = 'Orca (old)'
const RESET_ANDROID_PACKAGE = 'dev.orca.app.reset'
const RESET_APP_LABEL = 'orca 重置版'

module.exports = function withAndroidRetiredAppName(config) {
  const pkg = config.android?.package
  const label =
    pkg === RETIRED_ANDROID_PACKAGE
      ? RETIRED_APP_LABEL
      : pkg === RESET_ANDROID_PACKAGE
        ? RESET_APP_LABEL
        : null
  if (!label) {
    return config
  }
  return withStringsXml(config, (mod) => {
    mod.modResults = AndroidConfig.Strings.setStringItem(
      [AndroidConfig.Resources.buildResourceItem({ name: 'app_name', value: label })],
      mod.modResults
    )
    return mod
  })
}
