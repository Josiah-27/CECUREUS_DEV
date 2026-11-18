/**
 * Build variants (https://docs.expo.dev/tutorial/eas/multiple-app-variants/).
 *
 * APP_VARIANT=beta builds "c_beta": a separate Google Play test app with its own package name, so the
 * real "CecureUs" listing and package (com.cecureus.app) stay unused until the production launch.
 * Only the store / home-screen name and the identifiers change — every screen inside the app still
 * says CecureUs (no screen reads the config name).
 *
 * Without APP_VARIANT this returns app.json unchanged.
 */
const BETA = {
  name: 'c_beta',
  identifier: 'com.cecureus.app.beta',
  scheme: 'cecureus-beta',
};

module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'beta') return config;
  return {
    ...config,
    name: BETA.name,
    scheme: BETA.scheme,
    ios: { ...config.ios, bundleIdentifier: BETA.identifier },
    android: { ...config.android, package: BETA.identifier },
  };
};
