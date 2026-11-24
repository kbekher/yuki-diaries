/**
 * Public-site UI language (menus, buttons, labels, dates). Independent of the language a post is WRITTEN in
 * (`posts.language`), which is never translated.
 *
 * URLs: Russian (default) has NO prefix (`/`, `/posts/x`); English lives under `/en`. Internally every public page
 * is served from `app/(site)/[lang]/…`; `src/proxy.ts` rewrites unprefixed requests to `/ru/…` and
 * `next.config.ts` redirects any visible `/ru/…` back to the unprefixed URL.
 *
 * Client-safe (no server imports) — the server-only root-param getter lives in `./ui-server.ts`.
 */
export const UI_LANGS = ["ru", "en"] as const;
export type UiLang = (typeof UI_LANGS)[number];
export const DEFAULT_UI_LANG: UiLang = "ru";

export function isUiLang(value: unknown): value is UiLang {
  return typeof value === "string" && (UI_LANGS as readonly string[]).includes(value);
}

/** BCP-47 tags for Intl formatting, og:locale, RSS `<language>`. */
export const UI_LANG_TAG: Record<UiLang, string> = { ru: "ru-RU", en: "en-US" };
/** Short switcher labels and full names. */
export const UI_LANG_LABEL: Record<UiLang, string> = { ru: "RU", en: "EN" };
export const UI_LANG_NAME: Record<UiLang, string> = { ru: "Русский", en: "English" };

/** Prefix path for a language: "" for the default (ru), "/en" for English. */
export function localePrefix(lang: UiLang): string {
  return lang === DEFAULT_UI_LANG ? "" : `/${lang}`;
}

/**
 * Locale-aware internal path: localePath("en", "/posts/x") → "/en/posts/x"; localePath("ru", "/") → "/".
 * Query strings and hashes are kept ("/search?q=a" → "/en/search?q=a"; "/" + "#latest" works via "/#latest").
 */
export function localePath(lang: UiLang, path: string = "/"): string {
  const prefix = localePrefix(lang);
  if (!prefix) return path.startsWith("/") ? path : `/${path}`;
  const rest = path.startsWith("/") ? path : `/${path}`;
  // "/" → "/en"; "/?page=2" → "/en?page=2"; "/#x" → "/en#x"
  if (rest === "/") return prefix;
  if (rest.startsWith("/?") || rest.startsWith("/#")) return `${prefix}${rest.slice(1)}`;
  return `${prefix}${rest}`;
}

/** Splits a public pathname into its UI language and the unprefixed path ("/en/tags" → ["en", "/tags"]). */
export function splitLocale(pathname: string): { lang: UiLang; path: string } {
  if (pathname === "/en") return { lang: "en", path: "/" };
  if (pathname.startsWith("/en/")) return { lang: "en", path: pathname.slice(3) };
  // A visible "/ru/…" is redirected away by next.config.ts, but be tolerant anyway.
  if (pathname === "/ru") return { lang: "ru", path: "/" };
  if (pathname.startsWith("/ru/")) return { lang: "ru", path: pathname.slice(3) };
  return { lang: "ru", path: pathname || "/" };
}

/** The same page in another UI language (keeps path; callers append the query string). */
export function switchLocalePath(pathname: string, target: UiLang): string {
  return localePath(target, splitLocale(pathname).path);
}

/** hreflang alternates for an unprefixed path, as site-relative URLs (resolved by `metadataBase`). */
export function languageAlternates(path: string): Record<string, string> {
  return { ru: localePath("ru", path), en: localePath("en", path), "x-default": localePath("ru", path) };
}
