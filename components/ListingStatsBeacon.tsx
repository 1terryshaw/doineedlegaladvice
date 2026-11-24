"use client";

// proof-of-life-stats-email-v1 — counts listing-page views and outbound phone / website clicks for a
// CLAIMED listing (mounted only on claimed listing pages). One view per listing per browser session
// (sessionStorage); every tel: click and every click through to the listing's own website counts.
// Event delegation, so every phone/website link on the page is covered. FAIL-OPEN: never breaks the page.
//
// Beacon v2 (telemetry integrity, lib/listing-stat-filter.ts): nothing is counted from automation
// (navigator.webdriver), an opted-out staff browser (?ls_internal=1), or the listing owner's device
// (remembered locally after the server recognises the owner's existing session cookie, or after a
// ?ref=owner link). The view is sent only once the page is visible. No identifier ever leaves the browser.
import { useEffect } from "react";
import { clientSkipReason, LS_INTERNAL, ownerKey, urlFlags } from "@/lib/listing-stat-filter";

function lsGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k: string, v: string | null) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* blocked */ } }

function post(listingSlug: string, kind: "view" | "phone" | "website") {
  try {
    const body = JSON.stringify({ listingSlug, kind });
    if (kind === "view") {
      // fetch (not sendBeacon) so the response can tell this browser it is the owner's device.
      void fetch("/api/listing-stat", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "same-origin" })
        .then((r) => { if (r.headers.get("x-ls-owner") === "1") lsSet(ownerKey(listingSlug), "1"); })
        .catch(() => {});
    } else if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/listing-stat", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/listing-stat", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch { /* fail-open */ }
}

function hostOf(url: string | null | undefined): string | null {
  try { return url ? new URL(url).hostname.replace(/^www\./, "").toLowerCase() : null; } catch { return null; }
}

export default function ListingStatsBeacon({ listingSlug, website }: { listingSlug: string; website?: string | null }) {
  useEffect(() => {
    const flags = urlFlags(window.location.search);
    if (flags.internal === "1") lsSet(LS_INTERNAL, "1");
    if (flags.internal === "0") lsSet(LS_INTERNAL, null);
    if (flags.ownerRef) lsSet(ownerKey(listingSlug), "1");
    const skip = () => clientSkipReason({
      webdriver: !!(navigator as Navigator & { webdriver?: boolean }).webdriver,
      internal: lsGet(LS_INTERNAL) === "1",
      ownerDevice: lsGet(ownerKey(listingSlug)) === "1",
    });

    const sendView = () => {
      if (skip()) return;
      const key = `ls_v:${listingSlug}`;
      try {
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          post(listingSlug, "view");
        }
      } catch { /* storage blocked → skip the view rather than double count */ }
    };
    let onVis: (() => void) | null = null;
    if (document.visibilityState === "visible") sendView();
    else { onVis = () => { if (document.visibilityState === "visible") { document.removeEventListener("visibilitychange", onVis!); onVis = null; sendView(); } }; document.addEventListener("visibilitychange", onVis); }

    const siteHost = hostOf(website);
    const onClick = (e: MouseEvent) => {
      if (skip()) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (/^tel:/i.test(href)) { post(listingSlug, "phone"); return; }
      if (siteHost && /^https?:\/\//i.test(href) && hostOf(href) === siteHost) post(listingSlug, "website");
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => { document.removeEventListener("click", onClick, { capture: true }); if (onVis) document.removeEventListener("visibilitychange", onVis); };
  }, [listingSlug, website]);
  return null;
}
