import { NotFoundContent } from "@/components/site/not-found-content";
import { getUiLang } from "@/lib/i18n/ui-server";

/** Rendered inside the site layout when a page calls `notFound()` (unknown post, tag, page number, …). */
export default async function NotFound() {
  return <NotFoundContent lang={await getUiLang()} />;
}
