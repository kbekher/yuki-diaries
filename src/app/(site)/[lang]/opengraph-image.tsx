import { ImageResponse } from "next/og";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { DEFAULT_UI_LANG, isUiLang } from "@/lib/i18n/ui";
import { site } from "@/lib/site";
import { loadOgFonts, OG_SIZE, OgCard } from "./_lib/og";

export const alt = site.name;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = isUiLang(raw) ? raw : DEFAULT_UI_LANG;
  const dict = getDictionary(lang);
  const title = site.name;
  const subtitle = dict.meta.siteDescription;
  const eyebrow = dict.home.eyebrow;

  return new ImageResponse(<OgCard eyebrow={eyebrow} title={title} subtitle={subtitle} brandTitle />, {
    ...OG_SIZE,
    fonts: await loadOgFonts(`${eyebrow}${title}${subtitle}`),
  });
}
