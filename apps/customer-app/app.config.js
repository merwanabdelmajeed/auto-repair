const shopConfig = require('../../shop.config.json');

module.exports = ({ config }) => ({
  ...config,
  name: shopConfig.shopName,
  extra: {
    ...config.extra,
    shopName: shopConfig.shopName,
    shopCity: shopConfig.shopCity,
  },
});
