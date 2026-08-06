"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import { emitEvent } from "@/components/AnalyticsTracker";
import { HAS_LIST_YOUR_BUSINESS } from "@/lib/add-business";

type ResolveState = "idle" | "checking" | "success" | "error";

export default function ClaimOrAddHub() {
  const [gbpUrl, setGbpUrl] = useState("");
  const [state, setState] = useState<ResolveState>("idle");
  const [message, setMessage] = useState("");
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    emitEvent({ surface: "directory", event_type: "started", payload: { feature: "claim_add_hub", action: "claim_add_hub_rendered" } });
  }, []);

  useEffect(() => {
    if (state !== "idle") statusRef.current?.focus();
  }, [state]);

  function selectRoute(route: "existing_listing_route_selected" | "missing_business_route_selected") {
    emitEvent({ surface: "directory", event_type: "started", payload: { feature: "claim_add_hub", action: route } });
  }

  async function resolveGbp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = gbpUrl.trim();
    emitEvent({ surface: "directory", event_type: "started", payload: { feature: "claim_add_hub", action: "gbp_link_submitted" } });
    if (!value) {
      setState("error");
      setMessage("Paste a Google Maps share link, or continue without it.");
      emitEvent({ surface: "directory", event_type: "error", payload: { feature: "claim_add_hub", action: "gbp_resolution_failed", reason: "empty" } });
      return;
    }
    setState("checking");
    setMessage("");
    try {
      const response = await fetch("/api/public/gbp-resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleMapsUrl: value }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.resolved) throw new Error(result?.error || "resolution_failed");
      setState("success");
      setMessage("Google profile found. This profile has not been connected. Continue searching or claiming the matching directory listing.");
      emitEvent({ surface: "directory", event_type: "completed", payload: { feature: "claim_add_hub", action: "gbp_resolution_succeeded" } });
    } catch {
      setState("error");
      setMessage("We couldn’t read that Google link. Try another link or continue without it.");
      emitEvent({ surface: "directory", event_type: "error", payload: { feature: "claim_add_hub", action: "gbp_resolution_failed", reason: "coarse_failure" } });
    }
  }

  return (
    <div className="space-y-6">
      <div className={`grid gap-5 ${HAS_LIST_YOUR_BUSINESS ? "lg:grid-cols-2" : ""}`} aria-label="Choose a route">
        <section className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="existing-listing-heading">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Route 1</p>
          <h2 id="existing-listing-heading" className="mt-2 text-2xl font-bold text-slate-900">Claim an existing listing</h2>
          <p className="mt-3 leading-7 text-slate-600">Search our directory for your business. When you find it, open the listing and choose <strong>Claim This Listing</strong>.</p>
          <form action="/directory" method="get" className="mt-5 space-y-3" onSubmit={() => selectRoute("existing_listing_route_selected")}>
            <div>
              <label htmlFor="claim-business-name" className="block text-sm font-semibold text-slate-800">Business name</label>
              <input id="claim-business-name" name="q" type="search" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700" placeholder="e.g. Bright Spark Electric" />
            </div>
            <div>
              <label htmlFor="claim-city" className="block text-sm font-semibold text-slate-800">City or location <span className="font-normal text-slate-500">(optional)</span></label>
              <input id="claim-city" name="city" type="search" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700" placeholder="e.g. Toronto" />
            </div>
            <button type="submit" className="min-h-11 w-full rounded-lg px-5 py-2.5 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" style={{ backgroundColor: verticalConfig.primaryColor }}>Search listings</button>
          </form>
          <Link href="/directory" onClick={() => selectRoute("existing_listing_route_selected")} className="mt-4 inline-flex min-h-11 items-center font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">Browse the full directory <span aria-hidden="true" className="ml-1">→</span></Link>
          <details className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4" onToggle={(event) => { if ((event.currentTarget as HTMLDetailsElement).open) emitEvent({ surface: "directory", event_type: "started", payload: { feature: "claim_add_hub", action: "gbp_helper_opened" } }); }}>
            <summary className="cursor-pointer font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">Need help finding your business?</summary>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <ol className="list-decimal space-y-1 pl-5"><li><a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" onClick={() => emitEvent({ surface: "directory", event_type: "listing_clicked", payload: { feature: "claim_add_hub", action: "maps_search_opened" } })} className="font-semibold text-slate-900 underline">Open Google Maps</a> and search for the business.</li><li>Find the correct Google profile.</li><li>Choose Share and copy its Google Maps link.</li><li>Paste it below to check the link.</li></ol>
              <form onSubmit={resolveGbp} className="space-y-2">
                <label htmlFor="claim-gbp-url" className="block font-semibold text-slate-800">Google Maps or Business Profile link <span className="font-normal text-slate-500">(optional)</span></label>
                <div className="flex flex-col gap-2 sm:flex-row"><input id="claim-gbp-url" type="url" inputMode="url" value={gbpUrl} onChange={(e) => { setGbpUrl(e.target.value); setState("idle"); setMessage(""); }} placeholder="Paste the link here" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700" /><button type="submit" disabled={state === "checking"} className="min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-semibold text-slate-800 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">{state === "checking" ? "Checking…" : "Check link"}</button></div>
                <p ref={statusRef} tabIndex={-1} role="status" aria-live="polite" className={`text-sm leading-6 focus-visible:outline-none ${state === "success" ? "text-emerald-700" : state === "error" ? "text-rose-700" : "text-slate-500"}`}>{message}</p>
              </form>
              <p className="text-xs text-slate-500">A resolved profile is only a finding aid. It is not saved here, does not prove ownership, and does not change claim eligibility.</p>
            </div>
          </details>
        </section>

        {HAS_LIST_YOUR_BUSINESS && (
        <section className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 shadow-sm" aria-labelledby="missing-business-heading">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Route 2</p>
          <h2 id="missing-business-heading" className="mt-2 text-2xl font-bold text-slate-900">Business not listed?</h2>
          <p className="mt-3 leading-7 text-slate-600">Add your business to the directory. You can also include its Google Maps link to make the listing easier to verify and complete.</p>
          <Link href="/list-your-business" onClick={() => { selectRoute("missing_business_route_selected"); emitEvent({ surface: "directory", event_type: "listing_clicked", payload: { feature: "claim_add_hub", action: "add_business_cta_clicked" } }); }} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-lg px-5 py-3 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" style={{ backgroundColor: verticalConfig.primaryColor }}>Add Your Business</Link>
          <p className="mt-3 text-sm text-slate-500">The add-business form includes an optional Google Maps or Business Profile link.</p>
        </section>
        )}
      </div>
    </div>
  );
}
