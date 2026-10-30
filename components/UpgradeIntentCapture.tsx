"use client";

// leads-plus-claim-continuity-v1 (TDL #1360): remembers the Leads Plus choice an owner arrived with (?plan=leads-plus&mode=…)
// so the owner dashboard can open that checkout after the claim e-mail / login round trip. Renders nothing.
// An owner who is already logged in and lands on /claim or /owner/login goes straight to their dashboard.
// Keyed on the pathname: the layout stays mounted across client-side <Link> navigations (/pricing → /claim?plan=…).
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { parseUpgradeIntent, intentCookieValue, UPGRADE_INTENT_COOKIE, UPGRADE_INTENT_MAX_AGE } from "@/lib/upgrade-intent";

export default function UpgradeIntentCapture() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const intent = parseUpgradeIntent((k) => sp.get(k));
      if (!intent) return;
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${UPGRADE_INTENT_COOKIE}=${intentCookieValue(intent)}; Max-Age=${UPGRADE_INTENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
      const path = window.location.pathname.replace(/\/$/, "");
      if (path !== "/claim" && path !== "/owner/login") return;
      fetch("/api/owner/context", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => { if (d?.authenticated && typeof d.slug === "string" && d.slug) window.location.replace(`/owner/${d.slug}`); })
        .catch(() => { /* logged out — the claim / login page stands */ });
    } catch { /* never break a page over this */ }
  }, [pathname]);
  return null;
}
