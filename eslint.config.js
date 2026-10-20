// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/*', '.expo/*'],
  },
  {
    rules: {
      // Never ship console logging of auth/booking payloads.
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
]);
