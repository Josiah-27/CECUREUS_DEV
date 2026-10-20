import { createContext, useContext, type ReactNode } from 'react';

import type { Endpoints } from '@/api';

const ApiContext = createContext<Endpoints | null>(null);

export function ApiProvider({ api, children }: { api: Endpoints; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): Endpoints {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside <ApiProvider>');
  return api;
}
