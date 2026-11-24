import Link from "next/link";
import { ArrowRight } from "lucide-react";
import clsx from "clsx";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { PostSummary } from "@/lib/posts/public-queries";
import { PostLabel } from "./post-label";
import { PostImage } from "./post-image";

/**
 * "Последние записи" row: a text column (label, serif title, excerpt, pill) next to ONE image (the first of
 * `post.images`, greyscale, colour on hover). `flip` puts the text on the right (desktop only).
 * No image → text-only row with a larger title.
 *
 * The title is the row's focusable link; the pill and the collage are mouse shortcuts to the same URL.
 */
export function SeriesRow({
  dict,
  post,
  flip = false,
  priority = false,
}: {
  dict: Dictionary;
  post: PostSummary;
  flip?: boolean;
  priority?: boolean;
}) {
  const href = `/posts/${post.slug}`;
  const count = Math.min(post.images.length, 1);

  const text = (
    <div className={clsx("flex flex-col", count > 0 && flip && "lg:order-2")}>
      <PostLabel publishedAt={post.publishedAt} location={post.location} />
      <h3
        className={clsx(
          "mt-3.5 font-serif font-semibold text-fg-strong text-balance",
          count === 0
            ? "max-w-[22ch] text-[2.25rem] leading-[1.08] tracking-[-0.02em] sm:text-[3rem]"
            : "text-[1.75rem] leading-[1.15] tracking-[-0.01em] sm:text-[1.875rem]",
        )}
      >
        <Link href={href} className="rounded-sm transition-colors duration-300 hover:text-accent">
          {post.title}
        </Link>
      </h3>
      {post.excerpt && (
        <p
          className={clsx(
            "mt-3.5 leading-[1.7] text-fg-muted text-pretty",
            count === 0 ? "max-w-[52ch] text-[1.0625rem]" : "max-w-[24rem] text-[0.9375rem]",
          )}
        >
          {post.excerpt}
        </p>
      )}
      <div className="mt-6">
        <Link href={href} tabIndex={-1} aria-hidden className="pill group">
          <span>{dict.home.readMore}</span>
          <ArrowRight aria-hidden className="pill-arrow size-4" strokeWidth={1.75} />
        </Link>
      </div>
    </div>
  );

  if (count === 0) {
    return <article className="border-t border-border pt-10">{text}</article>;
  }

  return (
    <article
      className={clsx(
        "grid gap-8 lg:items-center lg:gap-10",
        // The image always gets the wider track, on whichever side it sits.
        flip ? "lg:grid-cols-[1.4fr_1fr]" : "lg:grid-cols-[1fr_1.4fr]",
      )}
    >
      {text}
      <Link href={href} tabIndex={-1} aria-hidden className={clsx("group block", flip && "lg:order-1")}>
        <PostImage
          post={post}
          tone="bw"
          priority={priority}
          sizes="(min-width: 1024px) 700px, 100vw"
          className="aspect-[3/2] w-full rounded-[1.125rem]"
        />
      </Link>
    </article>
  );
}
