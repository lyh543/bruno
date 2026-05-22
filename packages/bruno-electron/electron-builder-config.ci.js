const baseConfig = require('./electron-builder-config');

const nightlyVersion = process.env.BRUNO_NIGHTLY_VERSION;

module.exports = {
  ...baseConfig,
  buildVersion: nightlyVersion || baseConfig.buildVersion,
  extraMetadata: nightlyVersion
    ? {
        ...(baseConfig.extraMetadata || {}),
        version: nightlyVersion
      }
    : baseConfig.extraMetadata,
  afterSign: undefined,
  mac: {
    ...baseConfig.mac,
    hardenedRuntime: false,
    identity: null
  }
};
