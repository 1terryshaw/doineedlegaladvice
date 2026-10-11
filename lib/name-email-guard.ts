// name-guard-followthrough-v1 (K395 R1/R2/R4, 2026-10-11).
//
// The DB guard `trg_zz_name_email_guard` refuses any write that would SERVE a row whose rendered
// name carries a personal-domain email address. It raises SQLSTATE 23514 with a message that starts
// EMPIRE_NAME_EMAIL_PERSONAL. Before this file the claim/verify routes sent that refusal to
// /claim/error as "The verification link is invalid or has expired", which tells the owner nothing.
//
// ONE RULE, ONE SOURCE: the classification is the DB function public.name_email_class (RPC). This file
// carries no copy of the regex or the domain list. Extend the list in
// public.empire_name_email_personal_domains, never here.

export const NAME_EMAIL_REASON = "name_email";
export const NAME_EMAIL_MESSAGE =
  "Please remove the email address from your business name, then try again.";

/** True when a supabase-js error is the name-email guard's refusal (not any other CHECK violation). */
export function isNameEmailRefusal(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null | undefined;
  return !!e && e.code === "23514" && String(e.message ?? "").startsWith("EMPIRE_NAME_EMAIL_PERSONAL");
}

/** Append ?reason=name_email (or &reason=…) to a /claim/error URL. */
export function withNameEmailReason(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}reason=${NAME_EMAIL_REASON}`;
}

// Structural, so this file never imports a repo-specific client path (lib/supabase vs supabase-admin).
type RpcCapable = {
  rpc: (fn: string, args: { p: string }) => PromiseLike<{ data: unknown; error: unknown }>;
};

/**
 * Submit-time pre-check: does any of these names carry a personal-domain email?
 * FAIL-OPEN by design: an RPC error returns false and the submission proceeds, because the DB
 * guard still refuses at publish time. This check only moves the message earlier; it is not the gate.
 */
export async function nameHasPersonalEmail(
  client: RpcCapable,
  ...names: Array<string | null | undefined>
): Promise<boolean> {
  for (const n of names) {
    if (!n || !n.includes("@")) continue;
    try {
      const { data, error } = await client.rpc("name_email_class", { p: n });
      if (!error && data === "personal") return true;
    } catch {
      /* fail-open — see above */
    }
  }
  return false;
}
