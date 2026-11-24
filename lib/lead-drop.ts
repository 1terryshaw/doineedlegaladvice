// proof-of-life phase 3 — privacy-safe aggregate logging of Leads Plus submissions the spam layers reject.
// Records ONLY (leads table, UTC day, reason) via the service-role-only lead_drop_inc() RPC — no IP, hash,
// UA, slug, name, contact or message. Never throws, never changes the response: spam protection is unchanged.
import { LEADS_TABLE } from "@/lib/leads-plus";

export type LeadDropReason = "honeypot" | "too_fast" | "rate_limited";

/** Mirrors shouldSilentDrop(): a filled honeypot wins; otherwise the drop was the sub-2.5s timer. */
export function silentDropReason(honeypot: unknown): LeadDropReason {
  return typeof honeypot === "string" && honeypot.trim() !== "" ? "honeypot" : "too_fast";
}

export async function logLeadDrop(reason: LeadDropReason): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase"); // lazy: keeps the pure helper testable
    const { error } = await supabaseAdmin.rpc("lead_drop_inc", { p_table: LEADS_TABLE, p_reason: reason });
    if (error) console.error("[lead-drop]", error.message);
  } catch (e) {
    console.error("[lead-drop]", (e as Error).message);
  }
}
