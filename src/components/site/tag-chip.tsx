import Link from "next/link";
import clsx from "clsx";
import { localePath, type UiLang } from "@/lib/i18n/ui";
import type { TagRef } from "@/lib/posts/public-queries";

export function TagChip({
  lang,
  tag,
  count,
  size = "sm",
}: {
  lang: UiLang;
  tag: TagRef;
  count?: string;
  size?: "sm" | "lg";
}) {
  return (
    <Link
      href={localePath(lang, `/tags/${tag.slug}`)}
      className={clsx(
        "inline-flex items-center gap-2 rounded-full bg-bg-elevated text-fg-muted",
        "transition-[background-color,color] duration-300 ease-apple hover:bg-pill hover:text-pill-fg",
        size === "sm" ? "h-8 px-3.5 text-[0.8125rem]" : "h-11 px-5 text-[0.9375rem]",
      )}
    >
      <span lang="ru">{tag.name}</span>
      {count && <span className="text-[0.8125rem] opacity-75">{count}</span>}
    </Link>
  );
}

export function TagList({ lang, tags, className }: { lang: UiLang; tags: TagRef[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <ul className={clsx("flex flex-wrap gap-2", className)}>
      {tags.map((tag) => (
        <li key={tag.slug}>
          <TagChip lang={lang} tag={tag} />
        </li>
      ))}
    </ul>
  );
}
