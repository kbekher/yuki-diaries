"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { fmt } from "@/lib/i18n/get-dictionary";
import { localePath, switchLocalePath, UI_LANG_LABEL, UI_LANG_NAME, UI_LANGS, type UiLang } from "@/lib/i18n/ui";

export type LanguageLabels = {
  /** Group label, e.g. "Interface language". */
  label: string;
  /** "Switch to {language}" */
  switchTo: string;
};

/**
 * Presentational `RU | EN` segmented control. `pathname` is the CURRENT public pathname (with or without the /en
 * prefix) and `search` its query string (with the leading "?" or ""); null while unknown (prerender fallback), in which
 * case each option links to the other language's home page.
 */
export function LanguageSwitchView({
  lang,
  labels,
  pathname,
  search,
  className,
  fill = false,
}: {
  lang: UiLang;
  labels: LanguageLabels;
  pathname: string | null;
  search: string;
  className?: string;
  /** Stretch the options over the available width (mobile menu). */
  fill?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={labels.label}
      className={clsx("inline-flex items-center rounded-full border border-border p-0.5", fill && "flex w-full", className)}
    >
      {UI_LANGS.map((target) => {
        const current = target === lang;
        const href = pathname === null ? localePath(target, "/") : `${switchLocalePath(pathname, target)}${search}`;
        return (
          <Link
            key={target}
            href={href}
            // Switching language changes the root layout (<html lang>), so it is a full navigation anyway.
            prefetch={false}
            lang={target}
            hrefLang={target}
            aria-current={current ? "true" : undefined}
            aria-label={current ? undefined : fmt(labels.switchTo, { language: UI_LANG_NAME[target] })}
            className={clsx(
              "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-[0.75rem] font-medium tracking-[0.08em] transition-colors duration-300 ease-apple md:min-h-9 md:min-w-9",
              fill && "flex-1",
              current ? "bg-surface-hover text-fg-strong" : "text-fg-muted hover:bg-surface hover:text-fg-strong",
            )}
          >
            <span translate="no">{UI_LANG_LABEL[target]}</span>
          </Link>
        );
      })}
    </div>
  );
}

/** Reads the current path + query (suspends during prerender; wrap in <Suspense fallback={<LanguageSwitchView … pathname={null} />}>). */
export function LanguageSwitch(props: Omit<Parameters<typeof LanguageSwitchView>[0], "pathname" | "search">) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  return <LanguageSwitchView {...props} pathname={pathname} search={query ? `?${query}` : ""} />;
}
