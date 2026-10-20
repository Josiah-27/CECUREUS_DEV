/**
 * Environment configuration.
 *
 * Only EXPO_PUBLIC_* values are available in the client bundle, and they are
 * PUBLIC: never put secrets (SMS credentials, DB passwords, API keys) here.
 * Expo inlines these at build time only when accessed as `process.env.EXPO_PUBLIC_X`.
 */

export type AppEnv = {
  apiBaseUrl: string;
  mediaBaseUrl: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  appEnv: 'development' | 'preview' | 'production';
  /** Development only: the app talks to a built-in fake backend instead of the network. */
  demoMode: boolean;
};

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

type RawEnv = {
  EXPO_PUBLIC_API_BASE_URL?: string;
  EXPO_PUBLIC_MEDIA_BASE_URL?: string;
  EXPO_PUBLIC_PRIVACY_POLICY_URL?: string;
  EXPO_PUBLIC_TERMS_URL?: string;
  EXPO_PUBLIC_APP_ENV?: string;
  EXPO_PUBLIC_DEMO_MODE?: string;
};

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '10.0.2.2'];
/** Private LAN ranges, so a phone on the same Wi-Fi can reach a dev mock server on the PC. */
const PRIVATE_LAN = /^(10\.\d+|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+$/;

function validateUrl(name: string, value: string | undefined, appEnv: AppEnv['appEnv']): string {
  if (!value) throw new EnvError(`${name} is not set`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new EnvError(`${name} is not a valid URL — it must start with http:// or https:// (got "${value}")`);
  }
  const isLocal = LOCAL_HOSTS.includes(url.hostname) || PRIVATE_LAN.test(url.hostname);
  if (url.protocol !== 'https:' && !(appEnv === 'development' && isLocal)) {
    throw new EnvError(`${name} must use https`);
  }
  return value.replace(/\/+$/, '');
}

export function parseEnv(raw: RawEnv): AppEnv {
  const appEnvRaw = raw.EXPO_PUBLIC_APP_ENV ?? 'development';
  if (appEnvRaw !== 'development' && appEnvRaw !== 'preview' && appEnvRaw !== 'production') {
    throw new EnvError('EXPO_PUBLIC_APP_ENV must be development, preview or production');
  }
  const appEnv = appEnvRaw;
  const demoMode = raw.EXPO_PUBLIC_DEMO_MODE === 'true';
  if (demoMode && appEnv !== 'development') {
    throw new EnvError('EXPO_PUBLIC_DEMO_MODE is only allowed when EXPO_PUBLIC_APP_ENV=development');
  }
  return {
    appEnv,
    demoMode,
    // In demo mode no network is used, so the API URL is optional.
    apiBaseUrl: validateUrl(
      'EXPO_PUBLIC_API_BASE_URL',
      raw.EXPO_PUBLIC_API_BASE_URL ?? (demoMode ? DEMO_API_BASE_URL : undefined),
      appEnv,
    ),
    mediaBaseUrl: validateUrl('EXPO_PUBLIC_MEDIA_BASE_URL', raw.EXPO_PUBLIC_MEDIA_BASE_URL, appEnv),
    privacyPolicyUrl: validateUrl(
      'EXPO_PUBLIC_PRIVACY_POLICY_URL',
      raw.EXPO_PUBLIC_PRIVACY_POLICY_URL,
      appEnv,
    ),
    termsUrl: validateUrl('EXPO_PUBLIC_TERMS_URL', raw.EXPO_PUBLIC_TERMS_URL, appEnv),
  };
}

/** Placeholder base URL used by the in-app fake backend in demo mode. */
export const DEMO_API_BASE_URL = 'http://localhost:4000/v1';

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cached) {
    cached = parseEnv({
      EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
      EXPO_PUBLIC_MEDIA_BASE_URL: process.env.EXPO_PUBLIC_MEDIA_BASE_URL,
      EXPO_PUBLIC_PRIVACY_POLICY_URL: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
      EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
      EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
      EXPO_PUBLIC_DEMO_MODE: process.env.EXPO_PUBLIC_DEMO_MODE,
    });
  }
  return cached;
}
