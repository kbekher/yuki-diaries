import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isUiLang, UI_LANG_TAG, UI_LANGS } from "@/lib/i18n/ui";
import { site } from "@/lib/site";
import { ThemeScript } from "@/components/theme-script";
import { TranslateGuard } from "@/components/translate-guard";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { fontVariables } from "@/app/fonts";
import { pageAlternates, siteOrigin } from "./_lib/seo";
import "@/app/globals.css";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1b1918" },
    { media: "(prefers-color-scheme: light)", color: "#e9e3dc" },
  ],
  colorScheme: "dark light",
};

/** `ru` is served at the unprefixed URLs (via a proxy rewrite), `en` under /en. */
export function generateStaticParams() {
  return UI_LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isUiLang(lang)) return {};
  const description = getDictionary(lang).meta.siteDescription;
  return {
    metadataBase: new URL(siteOrigin),
    title: { default: site.name, template: `%s — ${site.name}` },
    description,
    applicationName: site.name,
    authors: [{ name: site.author }],
    creator: site.author,
    alternates: pageAlternates(lang),
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: UI_LANG_TAG[lang].replace("-", "_"),
      alternateLocale: UI_LANGS.filter((l) => l !== lang).map((l) => UI_LANG_TAG[l].replace("-", "_")),
      title: site.name,
      description,
    },
    twitter: { card: "summary_large_image", title: site.name, description },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

/**
 * Root layout of the public site (the admin has its own root layout). `[lang]` is the UI language (ru | en);
 * post content stays in whatever language the author wrote it in (marked with `lang` on the content elements).
 */
export default async function SiteLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isUiLang(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <html lang={lang} className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <TranslateGuard />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="fixed top-3 left-3 z-50 -translate-y-16 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-transform duration-300 ease-apple focus-visible:translate-y-0"
        >
          <span>{dict.a11y.skipToContent}</span>
        </a>
        <SiteHeader lang={lang} dict={dict} />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter lang={lang} dict={dict} />
      </body>
    </html>
  );
}
