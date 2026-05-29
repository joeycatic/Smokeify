export const LANGUAGE_COOKIE_NAME = "gv-language";
export const LANGUAGE_CHANGE_EVENT = "gv-language-change";

export const SUPPORTED_LANGUAGES = ["de", "en"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "de";

export function isLanguage(value: string | null | undefined): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

export function normalizeLanguage(
  value: string | null | undefined,
): Language {
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}

export function getLanguageTag(language: Language) {
  return language === "en" ? "en" : "de";
}

export function getNumberFormatLocale(language: Language) {
  return language === "en" ? "en-US" : "de-DE";
}

