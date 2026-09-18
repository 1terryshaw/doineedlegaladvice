"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

import { HONEYPOT_FIELD } from "@/lib/lane-botid";
import { LANE_ACCENT, LANE_NOTICE_BG, LANE_NOTICE_BORDER } from "@/lib/lane-gate";
import { US_STATE_CODES } from "@/lib/region-scope";

type Handoff = { heading: string; body: string; cta: string };

/**
 * THE INTAKE FORM.
 *
 * It is a client component because BotID's protection needs client JS on the page, and because
 * the finder's handoff (outcomes 1–3) has to be SHOWN before the submitter is sent to
 * `/claim/…` — a bare redirect would drop the one piece of copy that R-0 ruling (a) exists to
 * deliver (§0, §5.3): that claiming a HELD record gives owner access and removal, and does NOT
 * publish it.
 *
 * 🔴 IT NEVER POSTS `/api/claim` AND MINTS NOTHING. On a handoff it renders the copy and offers
 * a LINK. The submitter completes the claim themselves, so the claim funnel is untouched by
 * the lane's existence.
 */
export default function SubmitListingForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [handoff, setHandoff] = useState<{ copy: Handoff; url: string } | null>(null);
  const renderedAt = useRef<number>(Date.now());
  const states = useMemo(() => Array.from(US_STATE_CODES).sort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const res = await fetch("/api/list-your-business", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...data, rendered_at: renderedAt.current }),
      });
      const json = (await res.json()) as {
        error?: string; outcome?: string; claim_url?: string; copy?: Handoff;
        prefill?: { q: string; city: string }; next?: string;
      };
      if (!res.ok) { setError(json.error ?? "Something went wrong. Please try again."); return; }
      if (json.outcome && json.outcome !== "no_match" && json.claim_url && json.copy) {
        const url =
          json.claim_url === "/claim" && json.prefill
            ? `/claim?q=${encodeURIComponent(json.prefill.q)}&city=${encodeURIComponent(json.prefill.city)}`
            : json.claim_url;
        setHandoff({ copy: json.copy, url });
        return;
      }
      window.location.href = json.next ?? "/list-your-business/sent";
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (handoff) {
    return (
      <section
        style={{ background: LANE_NOTICE_BG, borderLeft: `4px solid ${LANE_NOTICE_BORDER}`, padding: "20px 24px" }}
        aria-live="polite"
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{handoff.copy.heading}</h2>
        {/*
          🔴 THIS IS THE §0 COPY, AND IT IS SERVED FROM THE LANE'S OWN SURFACE, BEFORE THE
          REDIRECT. `app/claim/[slug]/page.tsx` is the claim path, and the lane does not edit
          the claim path — its honest-copy banner fires only on DENY_restricted_or_unmapped, so
          the ALLOW population would otherwise be told nothing about the fact that claiming
          will not publish them. Saying it here is what keeps the front door honest.
        */}
        <p style={{ margin: "10px 0 18px", lineHeight: 1.6 }}>{handoff.copy.body}</p>
        <a
          href={handoff.url}
          style={{ display: "inline-block", background: LANE_ACCENT, color: "#fff", borderRadius: 6, padding: "10px 18px", fontWeight: 600, textDecoration: "none" }}
        >
          {handoff.copy.cta}
        </a>
        <p style={{ marginTop: 16, fontSize: 13, color: "#64748b" }}>
          Nothing has been saved. You can go back and change what you entered.
        </p>
      </section>
    );
  }

  const input = (name: string, label: string, required = false, type = "text") => (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>
        {label}{required ? "" : <span style={{ fontWeight: 400, color: "#64748b" }}> (optional)</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, marginTop: 4 }}
      />
    </label>
  );

  return (
    <form onSubmit={submit}>
      {/*
        L1 — the honeypot. Hidden from people and from assistive technology, present in the DOM
        for anything that fills every field it finds. A hit responds EXACTLY like a success and
        writes nothing.
      */}
      <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
        <label htmlFor={HONEYPOT_FIELD}>Leave this field empty</label>
        <input id={HONEYPOT_FIELD} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {input("business_name", "Business name", true)}
      {input("contact_name", "Your name")}
      {input("address_line", "Street address")}
      {input("city", "City", true)}
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>State</span>
        <select
          name="region_state"
          required
          defaultValue=""
          style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, marginTop: 4 }}
        >
          <option value="" disabled>Choose a state</option>
          {states.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      {input("postal_code", "ZIP code")}
      {input("phone", "Phone", false, "tel")}
      {input("website", "Website", false, "text")}
      {input("public_email", "Public email to show on the page", false, "email")}
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>
          Description<span style={{ fontWeight: 400, color: "#64748b" }}> (optional)</span>
        </span>
        <textarea
          name="description"
          rows={4}
          style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, marginTop: 4 }}
        />
      </label>
      {input("submitted_by_email", "Your email (we send a confirmation link here)", true, "email")}

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      <button
        type="submit"
        disabled={busy}
        style={{ background: LANE_ACCENT, color: "#fff", border: 0, borderRadius: 6, padding: "12px 22px", fontWeight: 600, opacity: busy ? 0.6 : 1 }}
      >
        {busy ? "Checking…" : "Submit listing"}
      </button>
      <p style={{ marginTop: 12, fontSize: 13, color: "#64748b" }}>
        We&apos;ll email you a confirmation link. Nothing is published until you open it and
        confirm.
      </p>
    </form>
  );
}
