'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { t as translate, type Locale, DEFAULT_LOCALE } from './index';

interface LanguageContextType {
    locale: Locale;
    t: (key: string, params?: Record<string, string | number>) => string;
    setLocale: (locale: Locale) => void;
}

const LanguageContext = createContext<LanguageContextType>({
    locale: DEFAULT_LOCALE,
    t: (key) => key,
    setLocale: () => {},
});

/**
 * LanguageProvider wraps the app and provides translation functions.
 * Fetches the user/company language from the API on mount.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

    useEffect(() => {
        fetch('/api/user/language')
            .then((r) => r.json())
            .then((data) => {
                if (data.language && ['en', 'pt-PT', 'fr'].includes(data.language)) {
                    setLocale(data.language as Locale);
                }
            })
            .catch(() => {
                // Keep default
            });
    }, []);

    const t = useCallback(
        (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
        [locale]
    );

    return (
        <LanguageContext.Provider value={{ locale, t, setLocale }}>
            {children}
        </LanguageContext.Provider>
    );
}

/**
 * useT() returns a translation function bound to the current language.
 * Usage: const { t, setLocale } = useT();  →  t('dashboard.welcomeBack', { name: 'Iago' })
 */
export function useT() {
    return useContext(LanguageContext);
}
