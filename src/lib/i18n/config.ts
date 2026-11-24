/**
 * The site is Russian-only: UI and posts are in Russian and every page is served with `<html lang="ru">`.
 * Readers who prefer Ukrainian, English, … use their browser's built-in page translation
 * (Chrome/Edge/Safari "Translate this page"), so there are no per-language URLs or translated copies.
 */
export const siteLocale = "ru";
/** BCP-47 tag for Intl formatting, og:locale, RSS `<language>` and JSON-LD `inLanguage`. */
export const siteLocaleTag = "ru-RU";

/**
 * Language codes of the database `locale` enum (`posts.source_locale`, `post_translations.locale`) and of the
 * pure text helpers (typography, transliteration, reading time). The schema is unchanged from the multilingual
 * days; posts are always written — and read — in `siteLocale`.
 */
export type Locale = "ru" | "uk" | "en";

/**
 * Language a single post is WRITTEN in (`posts.language`). Drives the admin editor's spellcheck, typography rules
 * and LanguageTool checks. Independent of `Locale` (the site itself stays Russian).
 */
export const TEXT_LANGUAGES = ["ru", "en", "fr"] as const;
export type TextLanguage = (typeof TEXT_LANGUAGES)[number];
export const DEFAULT_TEXT_LANGUAGE: TextLanguage = "ru";
export const TEXT_LANGUAGE_LABELS: Record<TextLanguage, string> = { ru: "Русский", en: "English", fr: "Français" };
/** BCP-47 tags for the HTML `lang` attribute (native spellcheck). */
export const TEXT_LANGUAGE_HTML: Record<TextLanguage, string> = { ru: "ru", en: "en-US", fr: "fr" };
/** LanguageTool language codes. */
export const TEXT_LANGUAGE_LT: Record<TextLanguage, string> = { ru: "ru-RU", en: "en-US", fr: "fr" };

export function isTextLanguage(value: unknown): value is TextLanguage {
  return typeof value === "string" && (TEXT_LANGUAGES as readonly string[]).includes(value);
}
