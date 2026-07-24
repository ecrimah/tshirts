'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { parseStorePricingValue } from '@/lib/pricing';

type StorePricingContextType = {
  salesActive: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const StorePricingContext = createContext<StorePricingContextType>({
  salesActive: false,
  loading: true,
  refresh: async () => {},
});

export function StorePricingProvider({ children }: { children: ReactNode }) {
  const [salesActive, setSalesActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetch('/api/settings?keys=store_pricing', { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : null
      );
      const value = data?.settings?.store_pricing;
      const parsed = parseStorePricingValue(value);
      setSalesActive(parsed.sales_active);
    } catch {
      setSalesActive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <StorePricingContext.Provider value={{ salesActive, loading, refresh }}>
      {children}
    </StorePricingContext.Provider>
  );
}

export function useStorePricing() {
  return useContext(StorePricingContext);
}
