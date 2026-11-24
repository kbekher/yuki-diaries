import Link from "next/link";
import { Suspense } from "react";
import { fmt, type Dictionary } from "@/lib/i18n/get-dictionary";
import { site } from "@/lib/site";
import { localePath, type UiLang } from "@/lib/i18n/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderFrame } from "./header-frame";
import { NavLinks, NavLinksView } from "./nav-links";
import { MobileMenu } from "./mobile-menu";
import { LanguageSwitch, LanguageSwitchView } from "./language-switch";

/**
 * The active nav item comes from usePathname(), which suspends while prerendering routes with unknown params —
 * so the nav sits in Suspense with a path-less fallback.
 */
export function SiteHeader({ lang, dict }: { lang: UiLang; dict: Dictionary }) {
  const navLabels = dict.nav;
  const themeLabels = dict.theme;

  const nav = (layout: "row" | "column") => (
    <Suspense fallback={<NavLinksView lang={lang} labels={navLabels} pathname={null} layout={layout} />}>
      <NavLinks lang={lang} labels={navLabels} layout={layout} />
    </Suspense>
  );

  // Like the nav, the switcher reads the current path/query on the client, so it sits in Suspense too.
  const languageSwitch = (fill: boolean) => (
    <Suspense
      fallback={<LanguageSwitchView lang={lang} labels={dict.language} pathname={null} search="" fill={fill} />}
    >
      <LanguageSwitch lang={lang} labels={dict.language} fill={fill} />
    </Suspense>
  );

  return (
    <HeaderFrame>
      <div className="relative mx-auto flex h-16 max-w-[75rem] items-center justify-between gap-4 px-5 sm:h-[4.5rem] sm:px-8 lg:px-12">
        <Link
          href={localePath(lang, "/")}
          aria-label={fmt(dict.a11y.home, { site: site.name })}
          className="brand-wordmark -mx-1 inline-flex min-h-11 items-center px-1 text-[1.125rem] text-fg-strong transition-opacity duration-300 ease-apple hover:opacity-75"
        >
          {site.name}
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <nav aria-label={dict.a11y.mainNav}>{nav("row")}</nav>
          <div className="ml-1">{languageSwitch(false)}</div>
          <ThemeToggle labels={themeLabels} />
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle labels={themeLabels} />
          <MobileMenu labels={{ open: dict.a11y.openMenu, close: dict.a11y.closeMenu }}>
            <nav aria-label={dict.a11y.mainNav}>{nav("column")}</nav>
            <div className="mt-2 border-t border-border pt-3">{languageSwitch(true)}</div>
          </MobileMenu>
        </div>
      </div>
    </HeaderFrame>
  );
}
