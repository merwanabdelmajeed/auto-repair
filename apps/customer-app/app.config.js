const shopConfig = require('../../shop.config.json');

// APP_VARIANT=dev builds the dev app (com.autorepair.customer.dev) so it
// installs alongside prod. iOS identity comes from here because ios/ is
// prebuild-generated; Android identity comes from the Gradle `dev`/`prod`
// product flavors (android/app/build.gradle), so the package below is kept in
// sync only to avoid an identity-mismatch warning during expo run:android.
const IS_DEV = process.env.APP_VARIANT === 'dev';
const baseName = shopConfig.appName ?? shopConfig.shopName;

module.exports = ({ config }) => ({
  ...config,
  // Home-screen icon label — deliberately shorter than the full shopName.
  // Long single-line names truncate on both iOS Springboard and Android
  // launchers; a short, wrap-friendly name avoids that regardless of the
  // exact per-OS wrapping behavior. Full branding still uses shopName
  // everywhere in-app via extra.shopName below.
  name: IS_DEV ? `${baseName} Dev` : baseName,
  ios: {
    ...config.ios,
    bundleIdentifier: IS_DEV ? 'com.autorepair.customer.dev' : config.ios.bundleIdentifier,
  },
  android: {
    ...config.android,
    package: IS_DEV ? 'com.autorepair.customer.dev' : config.android.package,
  },
  extra: {
    ...config.extra,
    shopName: shopConfig.shopName,
    shopCity: shopConfig.shopCity,
    shopAddress: shopConfig.shopAddress,
  },
});
