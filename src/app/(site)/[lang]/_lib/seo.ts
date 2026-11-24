import type { Metadata } from "next";
import { fmt, getDictionary } from "@/lib/i18n/get-dictionary";
import { languageAlternates, localePath, type UiLang } from "@/lib/i18n/ui";
import { site } from "@/lib/site";

/** Site origin without a trailing slash. */
export const siteOrigin = site.url.replace(/\/+$/, "");

/** Absolute URL for a site-relative path ("/posts/x" → "https://…/posts/x"). */
export function absoluteUrl(path: string): string {
  return `${siteOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Unprefixed RSS path; use `rssPath(lang)` for the URL of a given UI language. */
export const RSS_PATH = "/rss.xml";
export const rssPath = (lang: UiLang) => localePath(lang, RSS_PATH);

/**
 * Canonical URL (current UI language), hreflang alternates (ru, en, x-default → the unprefixed Russian URL) and the
 * RSS feed link for a page. `path` is the UNPREFIXED path ("/posts/x"). Pages must spread this into `alternates`
 * because metadata merging is shallow (a page's `alternates` replaces the layout's entirely).
 */
export function pageAlternates(lang: UiLang, path = "/"): NonNullable<Metadata["alternates"]> {
  return {
    canonical: localePath(lang, path),
    languages: languageAlternates(path),
    types: {
      "application/rss+xml": [{ url: rssPath(lang), title: fmt(getDictionary(lang).meta.rssTitle, { site: site.name }) }],
    },
  };
}

/** Serializes JSON-LD safely for inline <script> (prevents `</script>` breakouts). */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
