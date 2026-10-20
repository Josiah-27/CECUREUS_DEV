import { EnvError, parseEnv } from '../env';

const base = {
  EXPO_PUBLIC_API_BASE_URL: 'https://eap.cecureus.com/api/mobile/v1/',
  EXPO_PUBLIC_MEDIA_BASE_URL: 'https://eap.cecureus.com/uploads',
  EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://cecureus.com/privacy-policy',
  EXPO_PUBLIC_TERMS_URL: 'https://cecureus.com/terms',
};

describe('parseEnv', () => {
  it('accepts valid https config and strips trailing slashes', () => {
    const env = parseEnv({ ...base, EXPO_PUBLIC_APP_ENV: 'production' });
    expect(env.apiBaseUrl).toBe('https://eap.cecureus.com/api/mobile/v1');
    expect(env.appEnv).toBe('production');
  });

  it('defaults to development', () => {
    expect(parseEnv(base).appEnv).toBe('development');
  });

  it('rejects a missing API URL', () => {
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_API_BASE_URL: undefined })).toThrow(EnvError);
  });

  it('rejects plain http in production', () => {
    expect(() =>
      parseEnv({
        ...base,
        EXPO_PUBLIC_APP_ENV: 'production',
        EXPO_PUBLIC_API_BASE_URL: 'http://eap.cecureus.com/api',
      }),
    ).toThrow(/https/);
  });

  it('allows http to a local mock server only in development', () => {
    const local = { ...base, EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:4000' };
    expect(parseEnv(local).apiBaseUrl).toBe('http://10.0.2.2:4000');
    expect(() => parseEnv({ ...local, EXPO_PUBLIC_APP_ENV: 'preview' })).toThrow(/https/);
  });

  it('allows http to a PC on the local Wi-Fi only in development', () => {
    for (const host of ['192.168.1.20', '10.0.0.5', '172.16.4.2']) {
      const lan = { ...base, EXPO_PUBLIC_API_BASE_URL: `http://${host}:4000/v1` };
      expect(parseEnv(lan).apiBaseUrl).toBe(`http://${host}:4000/v1`);
      expect(() => parseEnv({ ...lan, EXPO_PUBLIC_APP_ENV: 'production' })).toThrow(/https/);
    }
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_API_BASE_URL: 'http://8.8.8.8:4000' })).toThrow(/https/);
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_API_BASE_URL: 'http://172.32.0.1:4000' })).toThrow(/https/);
  });

  it('supports demo mode in development without an API URL', () => {
    const env = parseEnv({ ...base, EXPO_PUBLIC_API_BASE_URL: undefined, EXPO_PUBLIC_DEMO_MODE: 'true' });
    expect(env.demoMode).toBe(true);
    expect(env.apiBaseUrl).toBe('http://localhost:4000/v1');
    expect(parseEnv(base).demoMode).toBe(false);
  });

  it('refuses demo mode outside development', () => {
    expect(() =>
      parseEnv({ ...base, EXPO_PUBLIC_APP_ENV: 'production', EXPO_PUBLIC_DEMO_MODE: 'true' }),
    ).toThrow(/DEMO_MODE/);
  });

  it('explains a URL that is missing http(s)://', () => {
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_API_BASE_URL: '192.168.31.214' })).toThrow(/http:\/\/ or https:\/\//);
  });

  it('rejects an unknown app env', () => {
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_APP_ENV: 'staging' })).toThrow(EnvError);
  });

  it('rejects malformed URLs', () => {
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_TERMS_URL: 'not a url' })).toThrow(/valid URL/);
  });
});
