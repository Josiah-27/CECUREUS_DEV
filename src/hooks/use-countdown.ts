import { useCallback, useState } from 'react';

import { useNow } from './use-now';

/** Counts down to a deadline once per second. Returns whole seconds remaining. */
export function useCountdown(initialSeconds: number) {
  const [deadline, setDeadline] = useState(() => Date.now() + initialSeconds * 1000);
  const now = useNow(1000);
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const restart = useCallback((seconds: number) => setDeadline(Date.now() + seconds * 1000), []);
  return { remaining, restart };
}
