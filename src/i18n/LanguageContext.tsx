import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Locale, useAuth } from '../context/AuthContext';
import { detectUserEnvironment } from '../utils/localeDetection';
import { en, TranslationKey } from './locales/en';
import { es } from './locales/es';

export type { Locale };

interface LanguageContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: TranslationKey) => string;
}

const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = {
  en,
  es,
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user, updateUserPreferences } = useAuth();
  const [locale, setLocaleState] = useState<Locale>(() => detectUserEnvironment().language);

  // Hydrate from active user's JSON preferences, or fall back to browser locale when signed out
  useEffect(() => {
    if (user?.preferences.language) {
      setLocaleState(user.preferences.language);
    } else {
      setLocaleState(detectUserEnvironment().language);
    }
  }, [user?.id, user?.preferences.language]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      if (user) {
        updateUserPreferences({ language: next });
      }
    },
    [user, updateUserPreferences]
  );

  const t = useCallback(
    (key: TranslationKey): string => {
      return DICTIONARIES[locale][key] ?? en[key] ?? key;
    },
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
