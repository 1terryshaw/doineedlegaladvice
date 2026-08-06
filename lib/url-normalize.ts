// Shared website-URL normalizer. Accepts bare domains (foo.com / www.foo.com) by
// prepending https://, keeps scheme-bearing URLs as-is, and rejects truly invalid
// input. Used by /list-your-business (server) + the add-business/owner-edit forms so
// owners are never blocked for omitting "https://". Empty is valid (website is optional).
export function normalizeWebsiteUrl(raw: string): { ok: boolean; url: string | null } {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { ok: true, url: null }; // optional field — blank is fine
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return { ok: false, url: null };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, url: null };
  // A real website has a dotted host — rejects "garbage", "localhost", trailing dots.
  const host = u.hostname;
  if (!host.includes(".") || host.startsWith(".") || host.endsWith(".") || /\s/.test(host)) {
    return { ok: false, url: null };
  }
  return { ok: true, url: candidate };
}
