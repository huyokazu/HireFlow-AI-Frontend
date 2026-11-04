import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { en, type Dictionary } from './en';
import type { Language, Localized } from './types';
import { vi } from './vi';

const DICTIONARIES: Record<Language, Dictionary> = { en, vi };

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  /** UI copy in the current language. */
  t: Dictionary;
  /** Picks the current language out of content that ships with the data. */
  pick: <T>(value: Localized<T>) => T;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Holds the current language. Switching only re-renders consumers; nothing is remounted,
 * so component state (deck position, selected fix, open drawer…) survives a language change.
 */
export function LanguageProvider({
  initialLanguage = 'en',
  children,
}: {
  initialLanguage?: Language;
  children: ReactNode;
}) {
  const [language, setLanguage] = useState<Language>(initialLanguage);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t: DICTIONARIES[language],
      pick: (localized) => localized[language],
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside a LanguageProvider');
  }
  return context;
}
