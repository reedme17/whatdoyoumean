/**
 * Localization infrastructure — simple key-based string lookup.
 *
 * Adding a new language requires only a new JSON resource file
 * and registering it here. No core code changes needed.
 *
 * Requirements: 5.5, 5.8, 5.9
 */

import en from "./en.json";
import zh from "./zh.json";

export type Locale = "en" | "zh";

type StringMap = Record<string, string>;

const locales: Record<Locale, StringMap> = { en, zh };

/**
 * Look up a localized string by key and locale.
 * Falls back to English if the key is missing in the requested locale.
 * Returns the key itself if not found in any locale.
 */
export function t(key: string, locale: Locale = "en"): string {
  return locales[locale]?.[key] ?? locales.en[key] ?? key;
}

/**
 * Get all available locale codes.
 */
export function getAvailableLocales(): Locale[] {
  return Object.keys(locales) as Locale[];
}

/**
 * Register a new locale at runtime (for dynamic loading).
 */
export function registerLocale(code: string, strings: StringMap): void {
  locales[code as Locale] = strings;
}
