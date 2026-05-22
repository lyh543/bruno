const baseConfig = require('./electron-builder-config');

module.exports = {
  ...baseConfig,
  afterSign: undefined,
  mac: {
    ...baseConfig.mac,
    hardenedRuntime: false,
    identity: null
  }
};
