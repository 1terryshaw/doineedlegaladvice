// lib/suppression.ts
// Empire email suppression (TDL #472). Canonical for the lead-to-claim engine.
//
// The AUTHORITATIVE source is the central public.email_suppressions table
// (email_normalized = lower(trim(email)), unique). NOT the per-vertical
// *_listings.outreach_unsubscribed mirror (that is a downstream copy). Decision (a),
// TDL #472 sign-off 2026-06-02.
//
// Used only to gate the claim-CTA pitch (a CEM). A suppressed destination still
// receives the lead forward — it just never carries the pitch.

import { supabaseAdmin } from "@/lib/supabase";

/**
 * True if this address is on the empire suppression list.
 * Fail-closed: on any query error/exception we return TRUE (treat as suppressed) so
 * an infra blip can never cause a non-consensual CEM. The caller gates ONLY the CTA
 * on this, never the lead itself — so fail-closed costs at most one un-pitched lead.
 */
export async function isSuppressed(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const norm = email.trim().toLowerCase();
  if (!norm) return false;
  try {
    const { data, error } = await supabaseAdmin
      .from("email_suppressions")
      .select("email_normalized")
      .eq("email_normalized", norm)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("isSuppressed query error:", error.message);
      return true; // fail-closed
    }
    return !!data;
  } catch (err) {
    console.error("isSuppressed exception:", err instanceof Error ? err.message : err);
    return true; // fail-closed
  }
}

/**
 * Add an address to the central suppression list (the unsubscribe target for
 * claim-pitch CEMs). Idempotent: email_normalized is UNIQUE, so a re-submit is a
 * no-op. `reason` and `source` are NOT NULL on the table.
 */
export async function suppressEmail(
  email: string,
  reason = "claim_pitch_unsubscribe",
  source = "claim_pitch_one_click",
): Promise<{ ok: boolean; error?: string }> {
  const clean = (email || "").trim();
  if (!clean) return { ok: false, error: "empty_email" };
  const { error } = await supabaseAdmin
    .from("email_suppressions")
    .insert({ email: clean, reason, source });
  // Unique-violation = already suppressed = success (idempotent).
  if (error && !/duplicate key|already exists|unique|23505/i.test(error.message)) {
    console.error("suppressEmail error:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
