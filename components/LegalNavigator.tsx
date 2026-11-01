"use client";

// LegalNavigator — TDL #1402. STAMPED, byte-identical in freelawyeradvice + doineedlegaladvice.
// Source of truth: ~/empire/legal-liability-containment-v1/stamp/components/LegalNavigator.tsx
//
// Deterministic legal-help navigator that replaces the generative legal chat.
//   - No free text. No LLM call. No network call of any kind.
//   - Stores NOTHING (not even step counts): selections live only in React state in the
//     visitor's browser and are gone on reload.
//   - Steps: 1 province/state → 2 category → 3 urgency → 4 result (type of licensed
//     professional + official resources + "Search lawyers" deep link).
//   - Urgent ⇒ the emergency / legal-aid block renders FIRST.
//   - Jurisdiction-locked: resources and the search link are for the selected
//     province/state only (no CA→US or province-mismatched recommendations).

import { useEffect, useRef, useState } from "react";
import {
  CA_PROVINCES, US_STATES, CATEGORIES, CA_RESOURCES, CA_NATIONAL, US_RESOURCES,
  professionalFor, emergencyLines,
  type CategoryId, type Country, type Jurisdiction, type Resource,
} from "@/lib/legal-navigator-data";

const FLA_ORIGIN = "https://freelawyeradvice.ca";
const DINLA_ORIGIN = "https://doineedlegaladvice.com";

export interface LegalNavigatorProps {
  /** Which site renders it — decides jurisdictions offered and where "Search lawyers" points. */
  site: "fla" | "dinla";
  /** CA province codes whose listings are served on DINLA (consolidation canary/fan-out). */
  caServedOnDinla: string[];
}

function searchHref(site: "fla" | "dinla", j: Jurisdiction, caServedOnDinla: string[]): string {
  const r = j.code.toLowerCase();
  if (j.country === "US") return site === "dinla" ? `/directory?region=${r}` : `${DINLA_ORIGIN}/directory?region=${r}`;
  const onDinla = caServedOnDinla.includes(j.code);
  if (site === "dinla") return onDinla ? `/directory?region=${r}` : `${FLA_ORIGIN}/directory?region=${r}`;
  return onDinla ? `${DINLA_ORIGIN}/directory?region=${r}` : `/directory?region=${r}`;
}

function ResourceItem({ r }: { r: Resource }) {
  return (
    <li className="text-sm text-gray-800">
      {r.url ? (
        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[#1d4ed8] underline underline-offset-2 hover:no-underline">
          {r.name}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <span>
          {r.name} <span className="text-gray-600">— search for their current contact details.</span>
        </span>
      )}
      {r.note && <span className="block text-gray-600">{r.note}</span>}
    </li>
  );
}

const stepBtn =
  "w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1a365d]";

export default function LegalNavigator({ site, caServedOnDinla }: LegalNavigatorProps) {
  const [jur, setJur] = useState<Jurisdiction | null>(null);
  const [cat, setCat] = useState<CategoryId | null>(null);
  const [urgent, setUrgent] = useState<boolean | null>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  const done = jur && cat && urgent !== null;
  useEffect(() => {
    if (done) resultRef.current?.focus();
  }, [done]);

  const reset = () => { setJur(null); setCat(null); setUrgent(null); };

  const options: { group: string; items: Jurisdiction[] }[] =
    site === "fla"
      ? [{ group: "Canada", items: CA_PROVINCES }]
      : [{ group: "United States", items: US_STATES }, { group: "Canada", items: CA_PROVINCES }];

  const country: Country | null = jur?.country ?? null;

  return (
    <section
      aria-labelledby="legal-nav-title"
      className="bg-white text-gray-900 border rounded-xl shadow-sm max-w-2xl mx-auto"
      id="navigator"
    >
      <div className="bg-[#1a365d] text-white p-4 rounded-t-xl">
        <h2 id="legal-nav-title" className="font-semibold text-lg">Find the right type of legal help</h2>
        <p className="text-sm opacity-90">
          Answer three quick questions. This tool gives general navigation information only — it is not legal advice.
        </p>
      </div>

      <div className="p-4 space-y-5">
        {/* Step 1 — jurisdiction */}
        <div>
          <label htmlFor="legal-nav-region" className="block text-sm font-semibold mb-1">
            1. Where are you? <span className="font-normal text-gray-600">({site === "fla" ? "province or territory" : "state, province or territory"})</span>
          </label>
          <select
            id="legal-nav-region"
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a365d]"
            value={jur ? `${jur.country}:${jur.code}` : ""}
            onChange={(e) => {
              const [c, code] = e.target.value.split(":");
              const all = [...CA_PROVINCES, ...US_STATES];
              setJur(all.find((j) => j.country === c && j.code === code) ?? null);
            }}
          >
            <option value="">Select…</option>
            {options.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((j) => (
                  <option key={`${j.country}:${j.code}`} value={`${j.country}:${j.code}`}>{j.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Step 2 — category */}
        {jur && (
          <fieldset>
            <legend className="text-sm font-semibold mb-2">2. What is it about?</legend>
            <div className="grid sm:grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={cat === c.id}
                  onClick={() => setCat(c.id)}
                  className={`${stepBtn} ${cat === c.id ? "bg-[#1a365d] text-white border-[#1a365d]" : "bg-white hover:bg-gray-50"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {/* Step 3 — urgency */}
        {jur && cat && (
          <fieldset>
            <legend className="text-sm font-semibold mb-2">
              3. Is anyone in danger, or is there an arrest, a court date or a deadline in the next few days?
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: true, l: "Yes" }, { v: false, l: "No / not sure" }].map((o) => (
                <button
                  key={o.l}
                  type="button"
                  aria-pressed={urgent === o.v}
                  onClick={() => setUrgent(o.v)}
                  className={`${stepBtn} text-center ${urgent === o.v ? "bg-[#1a365d] text-white border-[#1a365d]" : "bg-white hover:bg-gray-50"}`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {/* Step 4 — result */}
        <div aria-live="polite">
          {done && jur && cat && country && (
            <div className="space-y-4 border-t pt-4">
              <h3 ref={resultRef} tabIndex={-1} className="text-base font-semibold focus:outline-none">
                Your result for {jur.name}
              </h3>

              {urgent && (
                <div role="alert" className="border-2 border-red-700 bg-red-50 rounded-lg p-3">
                  <p className="font-semibold text-red-800 text-sm mb-1">Urgent help</p>
                  <ul className="space-y-1">
                    {emergencyLines(country).map((l) => (
                      <li key={l.label} className="text-sm text-gray-900">
                        <span className="font-semibold">{l.label}: </span>
                        {l.href ? <a href={l.href} className="underline">{l.detail}</a> : l.detail}
                      </li>
                    ))}
                  </ul>
                  {country === "CA" && CA_RESOURCES[jur.code] && (
                    <ul className="mt-2 space-y-1"><ResourceItem r={CA_RESOURCES[jur.code].legalAid} /></ul>
                  )}
                </div>
              )}

              {(() => {
                const p = professionalFor(country, jur.code, cat);
                return (
                  <div>
                    <p className="text-sm text-gray-700">The type of licensed professional who usually handles this:</p>
                    <p className="text-lg font-semibold">{p.title}</p>
                    {p.notes.map((n) => <p key={n} className="text-sm text-gray-700 mt-1">{n}</p>)}
                  </div>
                );
              })()}

              <div>
                <p className="text-sm font-semibold mb-1">Official resources</p>
                <ul className="space-y-2 list-disc pl-5">
                  {country === "CA" && CA_RESOURCES[jur.code] && (
                    <>
                      <ResourceItem r={CA_RESOURCES[jur.code].referral} />
                      {!urgent && <ResourceItem r={CA_RESOURCES[jur.code].legalAid} />}
                      {CA_RESOURCES[jur.code].publicInfo && <ResourceItem r={CA_RESOURCES[jur.code].publicInfo!} />}
                      {(CA_NATIONAL[cat] ?? []).map((r) => <ResourceItem key={r.name} r={r} />)}
                    </>
                  )}
                  {country === "US" && US_RESOURCES.map((r) => <ResourceItem key={r.name} r={r} />)}
                </ul>
              </div>

              <a
                href={searchHref(site, jur, caServedOnDinla)}
                className="block w-full py-3 rounded-lg text-white font-semibold text-center bg-[#1a365d] hover:bg-[#0f2440] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1a365d]"
              >
                Search lawyers in {jur.name}
              </a>
              <p className="text-xs text-gray-600">
                Listings are compiled from public records; inclusion is not an endorsement. Lawyers set their own fees.
              </p>
              <button type="button" onClick={reset} className="text-sm underline text-gray-700">
                Start over
              </button>
            </div>
          )}
        </div>

        {!urgent && (
          <p className="text-xs text-gray-600 border-t pt-3">
            In an emergency call 911. Thoughts of suicide: call or text 988.
          </p>
        )}

        <p className="text-xs text-gray-600">
          <span className="font-semibold">Privacy:</span> this navigator runs entirely in your browser. We don&apos;t
          collect or store your answers, and nothing you select is sent to us or to any AI service. There is no
          text box — please don&apos;t send us details of your situation.
        </p>
      </div>
    </section>
  );
}
