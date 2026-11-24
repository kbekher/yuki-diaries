import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import { isUiLang, type UiLang } from "./ui";

/**
 * The UI language of the current public route (the `[lang]` root param). Server Components only — not usable in
 * Route Handlers (use their `params`) or Client Components (pass it via props). Unknown values 404.
 */
export async function getUiLang(): Promise<UiLang> {
  const value = await lang();
  if (!isUiLang(value)) notFound();
  return value;
}
