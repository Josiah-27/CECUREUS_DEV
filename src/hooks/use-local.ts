import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Loads an on-device collection and lets callers replace it after a mutation. */
export function useLocalCollection<T>(load: () => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let active = true;
    loadRef.current().then(
      (result) => {
        if (active) {
          setItems(result);
          setLoading(false);
        }
      },
      () => {
        if (active) setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    loadRef.current()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return { items, setItems, loading, reload };
}
