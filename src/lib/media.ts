import { getEnv } from '@/config/env';

/** Resolves a media reference that may be an absolute https URL or a bare filename from the CMS. */
export function resolveMediaUrl(ref: string | null | undefined, base: string = getEnv().mediaBaseUrl): string | null {
  if (!ref) return null;
  if (/^https:\/\//i.test(ref)) return ref;
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) return null; // reject http:, data:, file:, javascript: etc.
  return `${base}/${ref.split('/').map(encodeURIComponent).join('/')}`;
}
