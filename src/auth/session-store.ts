import * as SecureStore from 'expo-secure-store';

import { authSessionSchema, type AuthSession } from '@/api/schemas';

const KEY = 'cecureus.session.v1';

/**
 * Persists the auth session in the platform keystore (Android Keystore-backed).
 * Tokens are never written to AsyncStorage or logs.
 */
export const sessionStore = {
  async load(now: number = Date.now()): Promise<AuthSession | null> {
    let raw: string | null;
    try {
      raw = await SecureStore.getItemAsync(KEY);
    } catch {
      return null;
    }
    if (!raw) return null;
    try {
      const session = authSessionSchema.parse(JSON.parse(raw));
      if (Date.parse(session.expiresAt) <= now) {
        await this.clear();
        return null;
      }
      return session;
    } catch {
      await this.clear();
      return null;
    }
  },

  async save(session: AuthSession): Promise<void> {
    await SecureStore.setItemAsync(KEY, JSON.stringify(session));
  },

  async clear(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {
      // Nothing stored or keystore unavailable; nothing else to do.
    }
  },

  async getToken(): Promise<string | null> {
    const session = await this.load();
    return session?.accessToken ?? null;
  },
};
