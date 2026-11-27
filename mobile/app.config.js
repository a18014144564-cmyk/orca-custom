// Bare expo-notifications defaults to sandbox entitlements while non-dev push-token.ts reports production, silently losing TestFlight/App Store pushes.
// Derive APNs mode from release workflow env; Expo still supplies app.json, including Fastlane version/buildNumber rewrites, for everything else.
const APS_ENVIRONMENT =
  process.env.ORCA_IOS_APS_ENVIRONMENT === 'production' ? 'production' : 'development'

const DISABLE_ANDROID_GOOGLE_SERVICES =
  process.env.ORCA_ANDROID_DISABLE_GOOGLE_SERVICES === 'true'

module.exports = ({ config }) => {
  const androidVersionName = process.env.ORCA_ANDROID_VERSION_NAME?.trim() || ''
  const buildVersionCode = Number.parseInt(process.env.ORCA_BUILD_VERSION_CODE ?? '', 10)
  const androidConfig = config.android ? { ...config.android } : undefined
  if (androidConfig && DISABLE_ANDROID_GOOGLE_SERVICES) {
    delete androidConfig.googleServicesFile
  }
  if (androidConfig && Number.isFinite(buildVersionCode) && buildVersionCode > 0) {
    androidConfig.versionCode = buildVersionCode
  }
  return {
    ...config,
    ...(androidVersionName ? { version: androidVersionName } : {}),
    // `expo run` installs a dev-client build cached for the current native fingerprint instead of
    // rebuilding; scripts/native-client.mjs populates the cache.
    buildCacheProvider: { plugin: './scripts/native-build-cache.cjs' },
    ...(androidConfig ? { android: androidConfig } : {}),
    ios: {
      ...config.ios,
      ...(Number.isFinite(buildVersionCode) && buildVersionCode > 0
        ? { buildNumber: String(buildVersionCode) }
        : {}),
      entitlements: { ...config.ios?.entitlements, 'aps-environment': APS_ENVIRONMENT }
    },
    plugins: (config.plugins ?? []).map((plugin) =>
      plugin === 'expo-notifications'
        ? [
            'expo-notifications',
            {
              enableBackgroundRemoteNotifications: true,
              mode: APS_ENVIRONMENT,
              icon: './assets/notification-icon.png'
            }
          ]
        : plugin
    )
  }
}
