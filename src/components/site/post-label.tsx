import clsx from "clsx";
import { fmt, formatDate, formatMonthYear, type Dictionary } from "@/lib/i18n/get-dictionary";
import type { UiLang } from "@/lib/i18n/ui";

/**
 * Tracked label line: "НОЯБРЬ 2026 | Альпы, Швейцария · 6 мин" (month + year in the site time zone, accent).
 * The location appears only when set; reading time only when `dict` + `readingMinutes` are passed.
 * Each dynamic part is its own element (translation-safe).
 */
export function PostLabel({
  lang,
  publishedAt,
  location,
  readingMinutes,
  dict,
  fullDate = false,
  className,
}: {
  /** UI language (month names, "min"). */
  lang: UiLang;
  publishedAt: Date;
  location?: string | null;
  readingMinutes?: number;
  dict?: Dictionary;
  /** Show day, month and year (post page) instead of month + year (lists). */
  fullDate?: boolean;
  className?: string;
}) {
  return (
    <p lang={lang} className={clsx("site-label flex flex-wrap items-center gap-x-2.5 gap-y-1", className)}>
      <time dateTime={publishedAt.toISOString()} className="site-label-accent">
        {fullDate ? formatDate(publishedAt, lang) : formatMonthYear(publishedAt, lang)}
      </time>
      {location && (
        <>
          <span aria-hidden className="opacity-60">
            |
          </span>
          <span>{location}</span>
        </>
      )}
      {dict && readingMinutes !== undefined && (
        <>
          <span aria-hidden className="opacity-60">
            ·
          </span>
          <span>{fmt(dict.post.minutesShort, { n: readingMinutes })}</span>
        </>
      )}
    </p>
  );
}
