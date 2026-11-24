import { notFound } from "next/navigation";

/**
 * Catch-all for unknown public URLs: renders `not-found.tsx` inside the site layout (so the 404 page keeps the header,
 * footer and the visitor's UI language) instead of falling through to the language-less `global-not-found`.
 * Deliberately reads no params, so it needs no `generateStaticParams`.
 */
export default function UnknownPage() {
  notFound();
}
