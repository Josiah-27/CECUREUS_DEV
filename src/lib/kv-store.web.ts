/**
 * WEB PREVIEW ONLY. The web build exists for design review (`npm run web`) and is never shipped.
 * Browsers have no keystore, so values live in sessionStorage and vanish when the tab closes.
 */
function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export async function getItemAsync(key: string): Promise<string | null> {
  return storage()?.getItem(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  storage()?.setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  storage()?.removeItem(key);
}
