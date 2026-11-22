"use client";

// proof-of-life-stats-email-v1 — counts listing-page views and outbound phone / website clicks for a
// CLAIMED listing (mounted only on claimed listing pages). One view per listing per browser session
// (sessionStorage); every tel: click and every click through to the listing's own website counts.
// Event delegation, so every phone/website link on the page — hero, contact card, sidebar, Leads Plus
// buttons — is covered without touching those components. FAIL-OPEN: never breaks the page.
import { useEffect } from "react";

function send(listingSlug: string, kind: "view" | "phone" | "website") {
  try {
    const body = JSON.stringify({ listingSlug, kind });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/listing-stat", new Blob([body], { type: "application/json" }));
    else void fetch("/api/listing-stat", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* fail-open */ }
}

function hostOf(url: string | null | undefined): string | null {
  try { return url ? new URL(url).hostname.replace(/^www\./, "").toLowerCase() : null; } catch { return null; }
}

export default function ListingStatsBeacon({ listingSlug, website }: { listingSlug: string; website?: string | null }) {
  useEffect(() => {
    const key = `ls_v:${listingSlug}`;
    try {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        send(listingSlug, "view");
      }
    } catch { /* storage blocked → skip the view rather than double count */ }

    const siteHost = hostOf(website);
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (/^tel:/i.test(href)) { send(listingSlug, "phone"); return; }
      if (siteHost && /^https?:\/\//i.test(href) && hostOf(href) === siteHost) send(listingSlug, "website");
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [listingSlug, website]);
  return null;
}
