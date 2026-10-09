"use client";

// leads-plus-canary-v1 — the Leads Plus lead form. Rendered ONLY behind leadFormGate() (server).
// Max 5 visible fields: name · email or phone · what you need · details (optional) · service (optional).
// Quote mode adds an optional budget range + a timing word.
import { useEffect, useRef, useState } from "react";
import verticalConfig from "@/lib/vertical.config";
import { BUDGET_OPTIONS, TIMING_OPTIONS } from "@/lib/leads-plus";

const primary = (verticalConfig as { primaryColor: string }).primaryColor;
const input = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

export default function LeadsPlusForm({
  listingSlug,
  businessName,
  services,
  defaultQuote = false,
}: {
  listingSlug: string;
  businessName: string;
  services: string[];
  defaultQuote?: boolean;
}) {
  const [quote, setQuote] = useState(defaultQuote);
  const [f, setF] = useState({ name: "", contact: "", need: "", details: "", service: "", budget: "", timing: "" });
  const [honeypot, setHoneypot] = useState("");
  const renderedAt = useRef(Date.now());
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");

  // "Get a quote" CTAs anywhere on the page jump here in quote mode.
  useEffect(() => {
    const sync = () => { if (window.location.hash === "#get-a-quote") setQuote(true); };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/leads-plus/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, listingSlug, mode: quote ? "quote" : "contact", honeypot, renderedAt: renderedAt.current }),
      });
      if (res.ok) { setStatus("sent"); return; }
      const d = await res.json().catch(() => null);
      setErr(d?.error || "Couldn't send. Please try again.");
      setStatus("error");
    } catch {
      setErr("Couldn't send. Please try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center" data-testid="leads-plus-sent">
        <p className="text-green-800 font-medium">Sent to {businessName}.</p>
        <p className="text-green-700 text-sm mt-1">They&apos;ll reply to you directly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3" data-testid="leads-plus-form" id="leads-plus-form">
      <input type="text" name="company_url" value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp-field" />
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-lg">{quote ? "Get a quote" : `Contact ${businessName}`}</h3>
        <button type="button" onClick={() => setQuote(!quote)} className="text-xs underline text-gray-600">
          {quote ? "Just a question?" : "Want a quote?"}
        </button>
      </div>
      <label className="block">
        <span className="sr-only">Your name</span>
        <input className={input} placeholder="Your name" required maxLength={120} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </label>
      <label className="block">
        <span className="sr-only">Email or phone</span>
        <input className={input} placeholder="Email or phone" required maxLength={254} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
      </label>
      <label className="block">
        <span className="sr-only">What do you need?</span>
        <input className={input} placeholder="What do you need?" required maxLength={300} value={f.need} onChange={(e) => setF({ ...f, need: e.target.value })} />
      </label>
      <label className="block">
        <span className="sr-only">Details (optional)</span>
        <textarea className={input} placeholder="Details (optional)" rows={3} maxLength={4000} value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} />
      </label>
      {services.length > 0 && (
        <label className="block">
          <span className="sr-only">Service (optional)</span>
          <select className={input} value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}>
            <option value="">Service (optional)</option>
            {services.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      )}
      {quote && (
        <div className="grid grid-cols-2 gap-2" data-testid="leads-plus-quote-fields">
          <select className={input} aria-label="Budget (optional)" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })}>
            <option value="">Budget (optional)</option>
            {BUDGET_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className={input} aria-label="Timing (optional)" value={f.timing} onChange={(e) => setF({ ...f, timing: e.target.value })}>
            <option value="">When?</option>
            {TIMING_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}
      <p className="text-xs text-gray-500" data-testid="leads-plus-consent">
        Your message goes to {businessName}, not to {verticalConfig.displayDomain}. They&apos;ll reply to you directly.
      </p>
      {status === "error" && <p className="text-red-600 text-sm" role="alert">{err}</p>}
      <button type="submit" disabled={status === "sending"} className="w-full py-2.5 rounded-lg text-white font-medium disabled:opacity-50" style={{ backgroundColor: primary }}>
        {status === "sending" ? "Sending…" : quote ? "Request a quote" : "Send message"}
      </button>
    </form>
  );
}
