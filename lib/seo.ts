import verticalConfig from "@/lib/vertical.config";

/**
 * Production canonical site URL. Reads NEXT_PUBLIC_BASE_URL env override first
 * (set in Vercel production env), falls back to verticalConfig.domain which is
 * stored as www form (Fix-7 standard).
 *
 * Trailing slash stripped so callers can concatenate paths safely.
 */
const cfgDomain = (verticalConfig as { domain?: string }).domain;

export const SITE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL ||
  (cfgDomain ? `https://${cfgDomain}` : "http://localhost:3000")
).replace(/\/$/, "");

/**
 * Build an absolute canonical URL for the given path.
 * Pass paths starting with "/" (e.g. "/directory", "/toronto/toronto").
 */
export function canonicalUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean}`;
}
