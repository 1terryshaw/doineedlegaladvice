// lib/inquiry-guard.ts
// Canonical inquiry guard for the empire (TDL #455). Do not fork per-vertical.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Scraper placeholders / known junk — treat as "no email".
const JUNK_EMAILS = new Set([
  "john@doe.com", "jane@doe.com", "test@test.com",
  "example@example.com", "email@email.com", "info@example.com",
]);

export function isValidEmail(email?: string | null): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return false;
  if (JUNK_EMAILS.has(e)) return false;
  if (e.endsWith("@doe.com") || e.endsWith("@example.com")) return false;
  return true;
}

// The address an inquiry would actually forward to: validated owner_email first,
// then the validated scraped `email`, else null. The route forwards to THIS,
// never to `owner_email || email` (the scraped-placeholder vector).
export function effectiveForwardEmail(
  listing?: { owner_email?: string | null; email?: string | null } | null,
): string | null {
  const owner = listing?.owner_email?.trim() ?? null;
  if (isValidEmail(owner)) return owner;
  const scraped = listing?.email?.trim() ?? null;
  if (isValidEmail(scraped)) return scraped;
  return null;
}

// A listing can receive a forwarded inquiry only if a forwarding address validates.
export function hasDeliverableEmail(
  listing?: { owner_email?: string | null; email?: string | null } | null,
): boolean {
  return effectiveForwardEmail(listing) !== null;
}

// Heuristic: the random-token bot signature (no spaces, long, mixed-case, vowel-starved).
function looksLikeRandomToken(s?: string): boolean {
  if (!s) return false;
  const t = s.trim();
  if (/\s/.test(t)) return false; // has spaces -> real human text
  if (t.length < 12) return false; // short single words are fine
  const letters = t.replace(/[^a-z]/gi, "");
  if (letters.length < 8) return false;
  const vowels = (letters.match(/[aeiou]/gi) || []).length;
  const vowelRatio = vowels / letters.length;
  const mixedCase = /[a-z]/.test(t) && /[A-Z]/.test(t);
  return mixedCase && vowelRatio < 0.25;
}

export type InquiryInput = {
  name?: string;
  email?: string;
  message?: string;
  honeypot?: string; // hidden field, must be empty for humans (Wave 2)
  renderedAt?: number; // epoch ms the form was rendered (Wave 2)
};

// SILENT DROP: honeypot tripped or impossibly-fast submit -> return ok:true silently,
// never tipping the bot. Does NOT include the email check — a malformed submitter
// email is a human typo and gets a 400 at the route so the visitor can fix it.
export function shouldSilentDrop(input: InquiryInput): boolean {
  if (input.honeypot && input.honeypot.trim() !== "") return true;
  if (typeof input.renderedAt === "number" && Date.now() - input.renderedAt < 2500) return true; // sub-2.5s = bot
  return false;
}

// QUARANTINE: store as spam_review, do not forward/notify. Fuzzy, so never drop.
export function looksLikeBotContent(input: InquiryInput): boolean {
  return looksLikeRandomToken(input.name) || looksLikeRandomToken(input.message);
}
