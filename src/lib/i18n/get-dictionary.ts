import { site } from "@/lib/site";
import ru, { type Dictionary, type PluralForms } from "./dictionaries/ru";
import en from "./dictionaries/en";
import { DEFAULT_UI_LANG, UI_LANG_TAG, UI_LANGS, type UiLang } from "./ui";

export type { Dictionary, PluralForms } from "./dictionaries/ru";

const dictionaries: Record<UiLang, Dictionary> = { ru, en };

/**
 * The UI dictionary for a UI language (default: Russian). Small plain objects, imported statically. Safe to use from
 * Server Components; Client Components should receive only the slice they need.
 */
export function getDictionary(lang: UiLang = DEFAULT_UI_LANG): Dictionary {
  return dictionaries[lang];
}

/** Fills `{key}` placeholders: fmt("Страница {page}", { page: 2 }) → "Страница 2". Unknown keys are left as-is. */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

function perLang<T>(make: (tag: string) => T): Record<UiLang, T> {
  return Object.fromEntries(UI_LANGS.map((l) => [l, make(UI_LANG_TAG[l])])) as Record<UiLang, T>;
}

const pluralRules = perLang((tag) => new Intl.PluralRules(tag));
const numberFormat = perLang((tag) => new Intl.NumberFormat(tag));

/** Picks the right plural form for `n` (Intl.PluralRules of the UI language) and fills `{n}`. */
export function plural(n: number, forms: PluralForms, lang: UiLang = DEFAULT_UI_LANG): string {
  const category = pluralRules[lang].select(n) as keyof PluralForms;
  const template = forms[category] ?? forms.other;
  return fmt(template, { n: numberFormat[lang].format(n) });
}

// Fixed site time zone keeps server rendering deterministic and dates correct for readers.
const dateFormat = perLang(
  (tag) => new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric", timeZone: site.timeZone }),
);

/** Long, human date: "2 ноября 2026 г." / "November 2, 2026". */
export function formatDate(date: Date | string, lang: UiLang = DEFAULT_UI_LANG): string {
  return dateFormat[lang].format(typeof date === "string" ? new Date(date) : date);
}

const monthFormat = perLang((tag) => new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: site.timeZone }));
const numericMonthFormat = perLang(
  (tag) => new Intl.DateTimeFormat(tag, { month: "2-digit", year: "numeric", timeZone: site.timeZone }),
);

/** Month and year for labels: "ноябрь 2026" / "November 2026" (no "г." suffix; labels are uppercased in CSS). */
export function formatMonthYear(date: Date | string, lang: UiLang = DEFAULT_UI_LANG): string {
  const parts = monthFormat[lang].formatToParts(typeof date === "string" ? new Date(date) : date);
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${month} ${year}`.trim();
}

/** Compact numeric date for vertical card labels: "2026 · 11". */
export function formatYearMonth(date: Date | string, lang: UiLang = DEFAULT_UI_LANG): string {
  const parts = numericMonthFormat[lang].formatToParts(typeof date === "string" ? new Date(date) : date);
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${year} · ${month}`;
}
