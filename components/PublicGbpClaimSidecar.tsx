"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import { emitEvent } from "@/components/AnalyticsTracker";

type Props = { listingSlug: string; listingName: string; address: string; listingClaimed: boolean };
type State = "idle" | "loading" | "success" | "error";

export default function PublicGbpClaimSidecar({ listingSlug, listingName, address, listingClaimed }: Props) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const statusRef = useRef<HTMLParagraphElement>(null);
  const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([listingName, address].filter(Boolean).join(", "))}`;

  useEffect(() => {
    emitEvent({ surface: "directory", event_type: "started", listing_slug: listingSlug, payload: { feature: "public_gbp_sidecar", action: "rendered" } });
  }, [listingSlug]);
  useEffect(() => { if (state !== "idle") statusRef.current?.focus(); }, [state]);
  if (listingClaimed) return null;

  async function resolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = url.trim();
    emitEvent({ surface: "directory", event_type: "started", listing_slug: listingSlug, payload: { feature: "public_gbp_sidecar", action: "link_submitted" } });
    if (!value) { setState("error"); setMessage("Paste a Google Maps share link to try it, or claim the listing below."); return; }
    setState("loading"); setMessage("");
    try {
      const response = await fetch("/api/public/gbp-resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ googleMapsUrl: value }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.resolved) throw new Error(result?.error || "resolution_failed");
      setState("success"); setMessage("Google profile found. You can now continue with the normal claim process.");
      emitEvent({ surface: "directory", event_type: "completed", listing_slug: listingSlug, payload: { feature: "public_gbp_sidecar", action: "resolution_succeeded" } });
    } catch {
      setState("error"); setMessage("We couldn’t read that Google link. You can try another link or claim the listing without it.");
      emitEvent({ surface: "directory", event_type: "error", listing_slug: listingSlug, payload: { feature: "public_gbp_sidecar", action: "resolution_failed", reason: "coarse_failure" } });
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby={`gbp-sidecar-${listingSlug}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Optional</p>
      <h2 id={`gbp-sidecar-${listingSlug}`} className="mt-1 text-lg font-semibold text-slate-900">Confirm your Google profile</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">This step is optional. Find your Google Maps profile, then continue with the normal claim process.</p>
      <a href={searchUrl} target="_blank" rel="noopener noreferrer" onClick={() => emitEvent({ surface: "directory", event_type: "listing_clicked", listing_slug: listingSlug, outbound_url: "https://www.google.com/maps/search/", payload: { feature: "public_gbp_sidecar", action: "maps_opened" } })} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Find on Google Maps <span className="ml-1" aria-hidden="true">↗</span></a>
      <p className="mt-2 text-xs leading-5 text-slate-500">Open your profile, choose Share, and copy the Google Maps link back here.</p>
      <form className="mt-4" onSubmit={resolve}>
        <label htmlFor={`gbp-url-${listingSlug}`} className="block text-sm font-medium text-slate-800">Google Maps link</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id={`gbp-url-${listingSlug}`} type="url" inputMode="url" autoComplete="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste your Google Maps share link" aria-describedby={`gbp-help-${listingSlug}`} className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" />
          <button type="submit" disabled={state === "loading"} className="min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{state === "loading" ? "Checking…" : "Use this Google profile"}</button>
        </div>
        <p id={`gbp-help-${listingSlug}`} className="mt-2 text-xs text-slate-500">We only check whether the link identifies a Google profile. It is not saved or connected.</p>
      </form>
      <p ref={statusRef} tabIndex={-1} role="status" aria-live="polite" className={`mt-4 text-sm leading-5 focus-visible:outline-none ${state === "success" ? "text-emerald-700" : state === "error" ? "text-rose-700" : "text-slate-600"}`}>{message}</p>
      <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-sm font-medium text-slate-900">{state === "success" ? "Google profile found" : "Ready to manage this business?"}</p>{state === "success" && <p className="mt-1 text-sm text-slate-600">This profile has not been connected yet. Continue to claim the listing.</p>}<Link href={`/claim/${listingSlug}?src=gbp_helper`} onClick={() => emitEvent({ surface: "directory", event_type: "listing_clicked", listing_slug: listingSlug, payload: { feature: "public_gbp_sidecar", action: "existing_claim_cta_clicked" } })} className="mt-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Claim This Listing</Link></div>
    </section>
  );
}
