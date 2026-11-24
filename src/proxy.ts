/**
 * Proxy (formerly "middleware") — runs before routes render (Node.js runtime by default).
 *
 * 1. Public UI language (en | ru). Pages live in `app/(site)/[lang]/…`; Russian (the default) has NO URL prefix:
 *      /…        → internal REWRITE to /ru/…   (the address bar keeps the unprefixed URL)
 *      /en/…     → passes through
 *      /ru/…, /uk/…  never get here: next.config.ts `redirects()` (which run BEFORE the proxy) 308 them to the
 *                    unprefixed URL, and a rewrite target is not re-checked against redirects — so the internal
 *                    /ru/… URL created below is never redirected back.
 *    No language detection, no cookies: the language is whatever the URL says.
 * 2. /admin/** auth gate (Russian only, never rewritten):
 *      no valid session ⇒ redirect to /admin/login?next=…;
 *      valid session on /admin/login ⇒ redirect to /admin. Rolling cookie refresh.
 *      (Every Server Action / Route Handler re-verifies the session itself.)
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_HOME,
  LOGIN_PATH,
  safeAdminRedirect,
  SESSION_COOKIE,
  SESSION_REFRESH_AFTER_SECONDS,
  sessionCookieOptions,
} from "@/lib/auth/config";
import { signSessionToken, verifySessionToken } from "@/lib/auth/jwt";

/** Rewrites unprefixed public URLs to the internal `/ru/…` route; `/en/…` (and stray `/ru`, `/uk`) pass through. */
function routePublic(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (first === "en" || first === "ru" || first === "uk") return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? "/ru" : `/ru${pathname}`; // the query string is kept by clone()
  return NextResponse.rewrite(url);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return routePublic(request);

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const isLogin = pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`);

  if (isLogin) {
    if (session) {
      // safeAdminRedirect only ever returns a same-origin /admin path (possibly with a query string).
      return NextResponse.redirect(new URL(safeAdminRedirect(request.nextUrl.searchParams.get("next")), request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    // Server Action POSTs are let through: the action re-checks the session and returns a friendly
    // error instead of a redirect, so unsaved editor content isn't lost.
    if (request.method === "POST" && request.headers.has("next-action")) return NextResponse.next();

    const url = new URL(LOGIN_PATH, request.url);
    const next = `${pathname}${search}`;
    if (next !== ADMIN_HOME) url.searchParams.set("next", next);
    const response = NextResponse.redirect(url);
    if (token) response.cookies.delete(SESSION_COOKIE); // drop expired / invalid cookie
    return response;
  }

  const response = NextResponse.next();
  // Rolling session: re-issue a fresh 30-day token at most once a day.
  const now = Math.floor(Date.now() / 1000);
  if (now - session.iat > SESSION_REFRESH_AFTER_SECONDS) {
    try {
      response.cookies.set(SESSION_COOKIE, await signSessionToken(session.email), sessionCookieOptions);
    } catch {
      // Missing secret can't happen here (verification succeeded); ignore refresh failures.
    }
  }
  return response;
}

export const config = {
  matcher: [
    // `:path*` also matches zero segments, so this covers /admin itself.
    "/admin/:path*",
    // Public pages, /rss.xml and the per-page OG/Twitter image routes. Skipped: Next internals, API routes, the admin
    // (matched above) and the root-level metadata files that are NOT under [lang] (favicon, icon.svg, apple-icon,
    // manifest, robots.txt, sitemap.xml). `(?:/|$)` keeps e.g. "/administrators" and "/iconic" matchable.
    "/((?!_next(?:/|$)|api(?:/|$)|admin(?:/|$)|favicon\\.ico$|icon\\.svg$|apple-icon(?:/|$|-)|manifest\\.webmanifest$|robots\\.txt$|sitemap\\.xml$).*)",
  ],
};
