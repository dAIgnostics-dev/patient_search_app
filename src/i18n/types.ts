export type Locale = 'hr' | 'en';

export const DEFAULT_LOCALE: Locale = 'hr';
export const LOCALE_STORAGE_KEY = 'cezih-locale';

export type TranslationParams = Record<string, string | number>;
