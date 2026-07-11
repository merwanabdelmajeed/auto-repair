const shopConfig = require('../../shop.config.json');

module.exports = ({ config }) => ({
  ...config,
  // Home-screen icon label — deliberately shorter than the full shopName.
  // Long single-line names truncate on both iOS Springboard and Android
  // launchers; a short, wrap-friendly name avoids that regardless of the
  // exact per-OS wrapping behavior. Full branding still uses shopName
  // everywhere in-app via extra.shopName below.
  name: shopConfig.appName ?? shopConfig.shopName,
  extra: {
    ...config.extra,
    shopName: shopConfig.shopName,
    shopCity: shopConfig.shopCity,
    shopAddress: shopConfig.shopAddress,
  },
});
