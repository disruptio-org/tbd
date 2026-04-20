import en from './en.json';
import ptPT from './pt-PT.json';
import fr from './fr.json';

export type Locale = 'en' | 'pt-PT' | 'fr';

const translations: Record<Locale, Record<string, Record<string, string>>> = {
    en,
    'pt-PT': ptPT,
    fr,
};

/**
 * Get a nested value from the translations using a dot key.
 * Supports interpolation: t('dashboard.welcomeBack', { name: 'Iago' })
 */
export function t(locale: Locale, key: string, params?: Record<string, string | number>): string {
    const [section, ...rest] = key.split('.');
    const subKey = rest.join('.');
    const dict = translations[locale] ?? translations.en;
    let value = dict?.[section]?.[subKey] ?? translations.en?.[section]?.[subKey] ?? key;

    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
    }

    return value;
}

/**
 * Get language display name
 */
export function getLanguageName(locale: Locale): string {
    const names: Record<Locale, string> = {
        en: 'English',
        'pt-PT': 'Português',
        fr: 'Français',
    };
    return names[locale] || locale;
}

/**
 * Get full language name for AI prompts (in that language)
 */
export function getAiLanguageName(locale: Locale): string {
    const names: Record<Locale, string> = {
        en: 'English',
        'pt-PT': 'Portuguese',
        fr: 'French',
    };
    return names[locale] || 'English';
}

export const SUPPORTED_LOCALES: Locale[] = ['en', 'pt-PT', 'fr'];
export const DEFAULT_LOCALE: Locale = 'en';
