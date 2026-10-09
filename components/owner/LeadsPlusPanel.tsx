"use client";

// leads-plus-canary-v1 — owner dashboard: Leads Plus. Shown ONLY on canary-enabled listings
// (leads_plus_enabled). Real owners stay OFF until Terry says go.
//   not entitled → "Get Leads Plus — $19/mo" (pay first; the kit opens on return)
//   entitled     → leads inbox · tap counts · test lead · settings · content kit · share · plan line
import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import verticalConfig from "@/lib/vertical.config";
import ContentKit from "@/components/owner/ContentKit";

const primary = (verticalConfig as { primaryColor: string }).primaryColor;

type Lead = {
  id: string; created_at: string; customer_name: string; customer_email: string | null; customer_phone: string | null;
  need: string; details: string | null; service: string | null; budget: string | null; timing: string | null;
  mode: string; status: "new" | "replied" | "closed"; is_test: boolean; notify_status: string;
};
type Data = {
  entitled: boolean; enabled: boolean; leads: Lead[]; taps: Record<string, number>; tapsWindowDays?: number;
  deliveryProblem?: { message: string } | null;
  settings?: { notify2: string; whatsapp: string; mode: "A" | "B" | null };
};

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
      onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}>
      {done ? "Copied" : label}
    </button>
  );
}

export default function LeadsPlusPanel({
  slug, businessName, listingUrl, phone, openKit,
}: {
  slug: string; businessName: string; listingUrl: string; phone: string | null; openKit: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [settings, setSettings] = useState({ notify2: "", whatsapp: "" });

  const load = useCallback(async () => {
    const r = await fetch(`/api/owner/leads-plus?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!r.ok) return;
    const d = (await r.json()) as Data;
    setData(d);
    if (d.settings) setSettings({ notify2: d.settings.notify2, whatsapp: d.settings.whatsapp });
  }, [slug]);
  useEffect(() => { void load(); }, [load]);

  async function patch(body: object) {
    setBusy(true); setMsg("");
    const r = await fetch("/api/owner/leads-plus", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...body }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(d.error || "Couldn't save."); return false; }
    await load();
    return true;
  }

  async function buy(mode: "trial" | "direct") {
    setBusy(true); setMsg("");
    const r = await fetch("/api/billing-redirect", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingSlug: slug, tier: "leads_plus", cycle: "monthly", mode }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (d.url) { window.location.href = d.url; return; }
    setMsg(d.message || d.error || "Checkout is unavailable right now.");
  }

  async function testLead() {
    setBusy(true); setMsg("");
    const r = await fetch("/api/owner/leads-plus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, action: "test_lead" }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? "Test lead sent — check your email (subject starts with [TEST])." : d.error || "Couldn't send a test lead.");
    await load();
  }

  if (!data) return null;
  if (!data.enabled) return null;

  if (!data.entitled) {
    return (
      <section className="border-2 rounded-lg p-6" style={{ borderColor: primary }} data-testid="leads-plus-buy">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: primary }}>New</p>
        <h2 className="text-xl font-bold mt-1">Leads Plus — $19 USD/mo</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
          <li>✓ Turns this listing page into a page that collects customer inquiries — same web address</li>
          <li>✓ Inquiries are emailed to you instantly; reply straight from your email</li>
          <li>✓ Content kit: we draft your page from your listing — you approve every word</li>
          <li>✓ Reviews Plus included</li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => buy("trial")} disabled={busy} className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: primary }} data-testid="lp-trial">
            {busy ? "Opening checkout…" : "Start 30-Day Free Trial"}
          </button>
          <button type="button" onClick={() => buy("direct")} disabled={busy} className="text-sm underline disabled:opacity-50" data-testid="lp-direct">
            Skip trial, pay now — $19/mo
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Monthly. Cancel anytime. Your inquiry form and content kit unlock as soon as you start.</p>
        {msg && <p className="text-sm text-red-600 mt-2">{msg}</p>}
        {data.leads.length > 0 && (
          <div className="mt-6 border-t pt-4" data-testid="leads-inbox-readonly">
            <h3 className="font-semibold">Your past inquiries (read-only)</h3>
            <p className="text-xs text-gray-500 mt-1">Leads Plus is not active. Your inquiry history is kept for 12 months.</p>
            <table className="w-full text-sm mt-2">
              <thead><tr className="text-left text-gray-500 border-b"><th className="py-2 pr-3">Date</th><th className="pr-3">Name</th><th className="pr-3">Need</th><th>Status</th></tr></thead>
              <tbody>{data.leads.map((l) => (
                <tr key={l.id} className="border-b align-top" data-testid="lead-row-readonly">
                  <td className="py-2 pr-3 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                  <td className="pr-3">{l.customer_name}{l.is_test && <span className="ml-1 text-[10px] bg-amber-100 text-amber-800 px-1 rounded">TEST</span>}</td>
                  <td className="pr-3">{l.need}</td>
                  <td className="capitalize">{l.status}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  const mode = data.settings?.mode ?? null;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const bio = `${businessName} — get a quote or contact us: ${listingUrl}`;
  const sig = `${businessName}${phone ? ` · ${phone}` : ""}\nGet a quote: ${listingUrl}`;
  const wa = `Hi! You can see our services and send us a request here: ${listingUrl}`;

  return (
    <section className="border rounded-lg p-6 space-y-8" data-testid="leads-plus-panel">
      <div>
        <h2 className="text-xl font-bold">Leads Plus</h2>
        <p className="text-sm text-gray-600 mt-1">Customers can send you inquiries from your listing page. Reviews Plus is included.</p>
      </div>

      {data.deliveryProblem && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800" role="alert" data-testid="leads-plus-bounce">
          {data.deliveryProblem.message}
        </div>
      )}

      {/* Leads inbox */}
      <div data-testid="leads-inbox">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold">Leads inbox</h3>
          <button type="button" onClick={testLead} disabled={busy} className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50 disabled:opacity-50" data-testid="send-test-lead">
            Send me a test lead
          </button>
        </div>
        {data.leads.length === 0 ? (
          <p className="text-sm text-gray-500 mt-2">No inquiries yet. Send yourself a test lead to see how they arrive.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b"><th className="py-2 pr-3">Date</th><th className="pr-3">Name</th><th className="pr-3">Need</th><th>Status</th></tr></thead>
              <tbody>
                {data.leads.map((l) => (
                  <Fragment key={l.id}>
                    <tr className="border-b align-top cursor-pointer" onClick={() => setOpen(open === l.id ? null : l.id)} data-testid="lead-row">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmt(l.created_at)}</td>
                      <td className="pr-3">{l.customer_name}{l.is_test && <span className="ml-1 text-[10px] bg-amber-100 text-amber-800 px-1 rounded">TEST</span>}</td>
                      <td className="pr-3">{l.need}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select value={l.status} onChange={(e) => void patch({ leadId: l.id, status: e.target.value })} className="border rounded px-1 py-0.5 text-sm" aria-label="Lead status">
                          <option value="new">New</option><option value="replied">Replied</option><option value="closed">Closed</option>
                        </select>
                      </td>
                    </tr>
                    {open === l.id && (
                      <tr className="border-b bg-gray-50"><td colSpan={4} className="p-3 text-sm space-y-1">
                        {l.customer_email && <p>Email: <a className="underline" href={`mailto:${l.customer_email}`}>{l.customer_email}</a></p>}
                        {l.customer_phone && <p>Phone: <a className="underline" href={`tel:${l.customer_phone}`}>{l.customer_phone}</a></p>}
                        {l.service && <p>Service: {l.service}</p>}
                        {l.budget && <p>Budget: {l.budget}</p>}
                        {l.timing && <p>Timing: {l.timing}</p>}
                        {l.details && <p className="whitespace-pre-line">{l.details}</p>}
                        {l.notify_status !== "sent" && <p className="text-red-700">Email notification: {l.notify_status}</p>}
                      </td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-500 mt-3" data-testid="tap-counts">
          Button taps, last {data.tapsWindowDays ?? 30} days — Call {data.taps.call ?? 0} · Email {data.taps.email ?? 0} · Website {data.taps.website ?? 0} · WhatsApp {data.taps.whatsapp ?? 0}.
          {" "}Taps are button presses, not leads.
        </p>
        {msg && <p className="text-sm mt-2" role="status">{msg}</p>}
      </div>

      {/* Settings */}
      <div className="space-y-3">
        <h3 className="font-semibold">Where inquiries go</h3>
        <p className="text-sm text-gray-600">Every inquiry is emailed to your login address with the subject “New inquiry”. Route it anywhere with our <a className="underline" href="/guides/leads">free routing guides</a>.</p>
        <label className="block text-sm">Second notification address (optional)
          <input className="mt-1 w-full border rounded px-3 py-2" type="email" value={settings.notify2} onChange={(e) => setSettings({ ...settings, notify2: e.target.value })} placeholder="office@example.com" />
        </label>
        <label className="block text-sm">WhatsApp number (optional — shows a WhatsApp button)
          <input className="mt-1 w-full border rounded px-3 py-2" value={settings.whatsapp} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })} placeholder="+1 555 010 0199" />
        </label>
        <button type="button" disabled={busy} onClick={() => void patch({ settings })} className="px-4 py-2 rounded text-white text-sm disabled:opacity-50" style={{ backgroundColor: primary }}>Save</button>
      </div>

      {/* Content kit (first question = Mode A/B) */}
      <ContentKit slug={slug} mode={mode} autoOpen={openKit} onModeChange={async (m) => { const ok = await patch({ settings: { mode: m } }); if (ok) router.refresh(); return ok; }} />

      {/* Share */}
      <div className="space-y-3" data-testid="leads-plus-share">
        <h3 className="font-semibold">Share your page</h3>
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <code className="bg-gray-100 rounded px-2 py-1 break-all">{listingUrl}</code>
          <Copy text={listingUrl} label="Copy link" />
          <a className="text-xs px-2 py-1 border rounded hover:bg-gray-50" href={`/api/owner/leads-plus/share?slug=${encodeURIComponent(slug)}&format=png`}>QR code (PNG)</a>
          <a className="text-xs px-2 py-1 border rounded hover:bg-gray-50" href={`/api/owner/leads-plus/share?slug=${encodeURIComponent(slug)}&format=pdf`}>Printable QR (PDF)</a>
        </div>
        {([["Social bio", bio], ["Email signature", sig], ["WhatsApp message", wa]] as const).map(([k, v]) => (
          <div key={k} className="text-sm">
            <div className="flex items-center justify-between"><span className="text-gray-600">{k}</span><Copy text={v} label="Copy" /></div>
            <pre className="mt-1 bg-gray-50 border rounded p-2 whitespace-pre-wrap text-xs">{v}</pre>
          </div>
        ))}
      </div>

    </section>
  );
}
