import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type QueryState<T> = {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
};

type Settled<T> = { token: string | null; data: T | undefined; error: unknown };

/** Primitive values identifying the request; a change triggers a new load. */
export type QueryKey = readonly (string | number | boolean | null | undefined)[];

/**
 * Minimal async data hook: loads on mount and whenever `key` changes,
 * ignores results from superseded requests, and exposes `reload` for retry.
 * Loading is derived (no synchronous setState in effects), so it is React Compiler safe.
 */
export function useQuery<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  key: QueryKey,
  options: { enabled?: boolean } = {},
): QueryState<T> {
  const enabled = options.enabled ?? true;
  const [nonce, setNonce] = useState(0);
  // Results are only accepted for the current token (key + reload counter).
  const token = `${JSON.stringify(key)}#${nonce}`;
  const [settled, setSettled] = useState<Settled<T>>({ token: null, data: undefined, error: undefined });

  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fnRef.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setSettled({ token, data, error: undefined });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setSettled((prev) => ({ token, data: prev.data, error }));
      },
    );
    return () => controller.abort();
  }, [token, enabled]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const isCurrent = settled.token === token;
  return {
    data: settled.data,
    error: isCurrent ? settled.error : undefined,
    loading: enabled && !isCurrent,
    reload,
  };
}
