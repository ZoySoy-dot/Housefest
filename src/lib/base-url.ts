import type { NextRequest } from "next/server";

/**
 * Resolves the public origin to use for redirect URLs (PayMongo success/cancel).
 *
 * The incoming request wins so the user is always returned to the host they are
 * actually browsing (housefest.site, a preview deployment, or localhost in dev).
 * Env vars are only a fallback for calls without a request context.
 */
export function baseUrlFrom(req?: NextRequest): string {
  const forwardedHost = req?.headers.get("x-forwarded-host");
  const host = forwardedHost ?? req?.headers.get("host");
  if (host) {
    const proto =
      req?.headers.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    return `${proto}://${host}`;
  }

  const env = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXTAUTH_URL;
  if (env) return env.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
