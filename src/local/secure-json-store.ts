import * as SecureStore from '@/lib/kv-store';

/**
 * Encrypted on-device JSON storage built on expo-secure-store (Android Keystore).
 * Values are split into chunks to stay under per-item size limits.
 * Used for private data (journal, moods, goals) that never leaves the device.
 */
const CHUNK = 1800;

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const countRaw = await SecureStore.getItemAsync(`${key}.n`);
    const count = Number(countRaw);
    if (!countRaw || !Number.isInteger(count) || count < 1) return fallback;
    let text = '';
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return fallback;
      text += part;
    }
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  const text = JSON.stringify(value);
  const previous = Number((await SecureStore.getItemAsync(`${key}.n`)) ?? 0) || 0;
  const count = Math.max(1, Math.ceil(text.length / CHUNK));
  for (let i = 0; i < count; i++) {
    await SecureStore.setItemAsync(`${key}.${i}`, text.slice(i * CHUNK, (i + 1) * CHUNK));
  }
  await SecureStore.setItemAsync(`${key}.n`, String(count));
  for (let i = count; i < previous; i++) {
    await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
}

export async function removeJson(key: string): Promise<void> {
  const previous = Number((await SecureStore.getItemAsync(`${key}.n`)) ?? 0) || 0;
  for (let i = 0; i < previous; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  await SecureStore.deleteItemAsync(`${key}.n`);
}
