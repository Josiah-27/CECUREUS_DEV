/* Global test setup: deterministic in-memory replacements for native modules. */

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`),
  };
});

process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.test.cecureus.local/v1';
process.env.EXPO_PUBLIC_MEDIA_BASE_URL = 'https://media.test.cecureus.local';
process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = 'https://cecureus.com/privacy-policy';
process.env.EXPO_PUBLIC_TERMS_URL = 'https://cecureus.com/terms';
process.env.EXPO_PUBLIC_APP_ENV = 'development';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(async () => ({ type: 'opened' })),
}));
