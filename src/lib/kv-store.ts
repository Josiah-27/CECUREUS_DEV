/**
 * Key-value storage for secrets and private data.
 * Native: expo-secure-store (Android Keystore / iOS Keychain). See kv-store.web.ts for the web preview.
 */
export { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';
