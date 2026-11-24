import type { MetadataRoute } from "next";
import { getAllPublishedSlugs } from "@/lib/posts/public-queries";
import { languageAlternates, localePath, UI_LANGS } from "@/lib/i18n/ui";
import { absoluteUrl } from "./(site)/[lang]/_lib/seo";

/** Absolute hreflang map for an unprefixed path. */
function alternates(path: string) {
  return Object.fromEntries(Object.entries(languageAlternates(path)).map(([k, v]) => [k, absoluteUrl(v)]));
}

/**
 * Every public page in both UI languages (ru unprefixed, en under /en), each entry carrying the hreflang alternates.
 * `/search` is noindex and left out.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPublishedSlugs();
  const latest = posts.reduce<Date | undefined>(
    (max, p) => (!max || p.updatedAt > max ? p.updatedAt : max),
    undefined,
  );

  const entry = (
    path: string,
    rest: Omit<MetadataRoute.Sitemap[number], "url" | "alternates">,
  ): MetadataRoute.Sitemap =>
    UI_LANGS.map((lang) => ({
      url: absoluteUrl(localePath(lang, path)),
      ...rest,
      alternates: { languages: alternates(path) },
    }));

  return [
    ...entry("/", { lastModified: latest, changeFrequency: "daily", priority: 1 }),
    ...entry("/tags", { lastModified: latest, changeFrequency: "weekly", priority: 0.4 }),
    ...posts.flatMap((p) =>
      entry(`/posts/${p.slug}`, { lastModified: p.updatedAt, changeFrequency: "monthly", priority: 0.8 }),
    ),
  ];
}
