"use client";

// leads-plus-claim-continuity-v1 (TDL #1360): on the owner dashboard, opens the Leads Plus checkout the owner chose before
// claiming / logging in — same /api/billing-redirect call the upgrade modal makes. One shot: the remembered choice is cleared
// first and the intent params are stripped from the URL, so Back from Stripe or a reload never re-opens it.
// `skip` (already on Leads Plus or above) only clears the remembered choice.
import { useEffect, useRef, useState } from "react";
import { UPGRADE_INTENT_COOKIE } from "@/lib/upgrade-intent";

export default function UpgradeIntentLauncher({ listingSlug, mode, skip = false }: { listingSlug: string; mode: "trial" | "direct"; skip?: boolean }) {
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    document.cookie = `${UPGRADE_INTENT_COOKIE}=; Max-Age=0; Path=/`;
    try {
      const url = new URL(window.location.href);
      ["plan", "mode", "cycle"].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch { /* cosmetic */ }
    if (skip) return;
    fetch("/api/billing-redirect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingSlug, tier: "leads_plus", cycle: "monthly", mode }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.url) window.location.assign(d.url);
        else setError(d?.message || d?.error || "We couldn't open checkout. Use the Leads Plus upgrade below.");
      })
      .catch(() => setError("Network error. Use the Leads Plus upgrade below."));
  }, [listingSlug, mode, skip]);

  if (skip) return null;
  return (
    <div role="status" data-testid="lp-intent-launcher" data-mode={mode} className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      {error ?? (mode === "trial" ? "Opening your Leads Plus free 30-day trial checkout…" : "Opening your Leads Plus checkout ($19 USD/mo)…")}
    </div>
  );
}
