import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { detectUserEnvironment } from '../utils/localeDetection';

export interface CurrencyMeta {
  code: string;
  name: string;
  symbol: string;
}

export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  { code: 'ARS', name: 'Argentine Peso', symbol: 'AR$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'BBD', name: 'Barbadian Dollar', symbol: 'Bds$' },
  { code: 'BOB', name: 'Bolivian Boliviano', symbol: 'Bs' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'BSD', name: 'Bahamian Dollar', symbol: 'B$' },
  { code: 'BZD', name: 'Belize Dollar', symbol: 'BZ$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CLP', name: 'Chilean Peso', symbol: 'CL$' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'COP', name: 'Colombian Peso', symbol: 'COL$' },
  { code: 'CRC', name: 'Costa Rican Colón', symbol: '₡' },
  { code: 'CUP', name: 'Cuban Peso', symbol: '₱' },
  { code: 'DOP', name: 'Dominican Peso', symbol: 'RD$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'GTQ', name: 'Guatemalan Quetzal', symbol: 'Q' },
  { code: 'GYD', name: 'Guyanese Dollar', symbol: 'GY$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'HNL', name: 'Honduran Lempira', symbol: 'L' },
  { code: 'HTG', name: 'Haitian Gourde', symbol: 'G' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'JMD', name: 'Jamaican Dollar', symbol: 'J$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'NIO', name: 'Nicaraguan Córdoba', symbol: 'C$' },
  { code: 'PAB', name: 'Panamanian Balboa', symbol: 'B/.' },
  { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/' },
  { code: 'PYG', name: 'Paraguayan Guaraní', symbol: '₲' },
  { code: 'SRD', name: 'Surinamese Dollar', symbol: 'SR$' },
  { code: 'TTD', name: 'Trinidad & Tobago Dollar', symbol: 'TT$' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U' },
  { code: 'VES', name: 'Venezuelan Bolívar', symbol: 'Bs.' },
  { code: 'XCD', name: 'East Caribbean Dollar', symbol: 'EC$' },
];

const SUPPORTED_CODES = new Set(SUPPORTED_CURRENCIES.map((c) => c.code));

const RATES_CACHE_KEY = 'growy_rates_v1';
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

const PRIMARY_RATE_ENDPOINT = 'https://open.er-api.com/v6/latest/USD';
const FALLBACK_RATE_ENDPOINT = 'https://api.exchangerate-api.com/v4/latest/USD';

interface CachedRates {
  rates: Record<string, number>;
  updatedAt: number;
}

interface CurrencyContextValue {
  currency: string;
  setCurrency: (code: string) => void;
  rates: Record<string, number>;
  lastUpdated: number | null;
  isRefreshing: boolean;
  rateError: boolean;
  refreshRates: () => Promise<void>;
  convertFromUSD: (amountInUSD: number) => number;
  convertBetween: (amount: number, fromCurrency: string, toCurrency?: string) => number;
  formatMoney: (amountInUSD: number, options?: { compact?: boolean }) => string;
  getRateFor: (code: string) => number;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

function readCachedRates(): CachedRates | null {
  try {
    const raw = localStorage.getItem(RATES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedRates>;
    if (parsed && typeof parsed.updatedAt === 'number' && parsed.rates && typeof parsed.rates === 'object') {
      return { rates: parsed.rates, updatedAt: parsed.updatedAt };
    }
  } catch {
    // ignore invalid cache
  }
  return null;
}

async function fetchUsdRates(): Promise<Record<string, number>> {
  const endpoints = [PRIMARY_RATE_ENDPOINT, FALLBACK_RATE_ENDPOINT];

  for (const url of endpoints) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = (await response.json()) as { rates?: Record<string, number> };
      if (data && data.rates && typeof data.rates.USD === 'number') {
        return data.rates;
      }
    } catch {
      // try next endpoint
    }
  }

  throw new Error('Unable to fetch exchange rates');
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user, updateUserPreferences } = useAuth();
  const [currency, setCurrencyState] = useState<string>(() => detectUserEnvironment().currency);

  const initialCache = readCachedRates();
  const [rates, setRates] = useState<Record<string, number>>(initialCache?.rates ?? { USD: 1 });
  const [lastUpdated, setLastUpdated] = useState<number | null>(initialCache?.updatedAt ?? null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rateError, setRateError] = useState(false);

  const lastUpdatedRef = useRef<number | null>(lastUpdated);
  const isRefreshingRef = useRef<boolean>(isRefreshing);
  lastUpdatedRef.current = lastUpdated;
  isRefreshingRef.current = isRefreshing;

  // Hydrate from active user's JSON preferences, or fall back to detected currency when signed out
  useEffect(() => {
    if (user?.preferences.currency && SUPPORTED_CODES.has(user.preferences.currency)) {
      setCurrencyState(user.preferences.currency);
    } else {
      setCurrencyState(detectUserEnvironment().currency);
    }
  }, [user?.id, user?.preferences.currency]);

  const refreshRates = useCallback(async () => {
    if (isRefreshingRef.current) return;
    setIsRefreshing(true);
    setRateError(false);
    try {
      const liveRates = await fetchUsdRates();
      const now = Date.now();
      setRates(liveRates);
      setLastUpdated(now);
      try {
        localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates: liveRates, updatedAt: now }));
      } catch {
        // ignore storage quota errors
      }
    } catch {
      setRateError(true);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Auto-refresh on mount, on tab visibility, and every 15m if cache is missing or > 12h old
  useEffect(() => {
    const syncIfStale = () => {
      const ts = lastUpdatedRef.current;
      if (!ts || Date.now() - ts > TWELVE_HOURS_MS) {
        void refreshRates();
      }
    };

    syncIfStale();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncIfStale();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = window.setInterval(syncIfStale, 15 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [refreshRates]);

  const setCurrency = useCallback(
    (code: string) => {
      if (!SUPPORTED_CODES.has(code)) return;
      setCurrencyState(code);
      if (user) {
        updateUserPreferences({ currency: code });
      }
    },
    [user, updateUserPreferences]
  );

  const getRateFor = useCallback(
    (code: string): number => {
      if (code === 'USD') return 1;
      const rate = rates[code];
      return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : 1;
    },
    [rates]
  );

  const convertFromUSD = useCallback(
    (amountInUSD: number): number => {
      return amountInUSD * getRateFor(currency);
    },
    [currency, getRateFor]
  );

  const convertBetween = useCallback(
    (amount: number, fromCurrency: string, toCurrency?: string): number => {
      const target = toCurrency ?? currency;
      if (fromCurrency === target) return amount;
      const fromRate = getRateFor(fromCurrency);
      const toRate = getRateFor(target);
      const amountInUSD = fromCurrency === 'USD' ? amount : amount / fromRate;
      return target === 'USD' ? amountInUSD : amountInUSD * toRate;
    },
    [currency, getRateFor]
  );

  const formatMoney = useCallback(
    (amountInUSD: number, options?: { compact?: boolean }): string => {
      const converted = convertFromUSD(amountInUSD);
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency,
          notation: options?.compact ? 'compact' : 'standard',
          maximumFractionDigits: currency === 'JPY' || currency === 'CLP' || currency === 'PYG' ? 0 : 2,
        }).format(converted);
      } catch {
        const meta = SUPPORTED_CURRENCIES.find((c) => c.code === currency);
        return `${meta?.symbol ?? currency} ${converted.toFixed(2)}`;
      }
    },
    [currency, convertFromUSD]
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        rates,
        lastUpdated,
        isRefreshing,
        rateError,
        refreshRates,
        convertFromUSD,
        convertBetween,
        formatMoney,
        getRateFor,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return ctx;
}
