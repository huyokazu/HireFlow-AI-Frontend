export type Language = 'en' | 'vi';

export const LANGUAGES: readonly Language[] = ['en', 'vi'];

/** A value written once per language, used for content that comes with the data (names of roles, AI text…). */
export type Localized<T = string> = Record<Language, T>;
