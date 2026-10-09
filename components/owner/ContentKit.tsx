"use client";

// leads-plus-canary-v1 — OWNER CONTENT KIT v1 editor. Shared component (logic in lib/content-kit.ts)
// so SWM can adopt it. First question sets Mode A/B. Each section: Accept / Edit / Delete / Replace,
// plus "Accept all from your listing". Nothing reaches the public page until "Approve & publish".
import { useCallback, useEffect, useState } from "react";
import verticalConfig from "@/lib/vertical.config";
import {
  SECTION_ORDER, LABEL_TEXT, sectionTitle, hoursEditable,
  type KitDraft, type KitSection, type KitValue, type SectionKey, type Faq,
} from "@/lib/content-kit";

const primary = (verticalConfig as { primaryColor: string }).primaryColor;
const LABEL_STYLE: Record<string, string> = {
  listing: "bg-green-100 text-green-800",
  suggested: "bg-blue-100 text-blue-800",
  example: "bg-amber-100 text-amber-800",
};

function toText(key: SectionKey, v: KitValue): string {
  if (v == null) return "";
  if (key === "faqs") return (v as Faq[]).map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");
  return Array.isArray(v) ? (v as string[]).join("\n") : String(v);
}
function fromText(key: SectionKey, t: string): KitValue {
  if (key === "faqs") {
    return t.split(/\n\s*\n/).map((b) => {
      const q = /Q:\s*([\s\S]*?)(?:\nA:|$)/.exec(b)?.[1]?.trim() ?? "";
      const a = /A:\s*([\s\S]*)$/.exec(b)?.[1]?.trim() ?? "";
      return { q, a };
    }).filter((f) => f.q && f.a);
  }
  if (key === "description" || key === "hours") return t;
  return t.split("\n").map((s) => s.trim()).filter(Boolean);
}

function Value({ s, lodgingHint = false, outdoorHint = false }: { s: KitSection; lodgingHint?: boolean; outdoorHint?: boolean }) {
  if (s.key === "hours" && s.value == null) return <p className="text-sm text-gray-500 italic">{outdoorHint ? "Not set — add your season and hours." : lodgingHint ? "Not set — add your check-in and check-out times." : "Not set — set your hours in Edit listing."}</p>;
  if (s.key === "photos") {
    const urls = (s.value as string[] | null) ?? [];
    return urls.length ? (
      <div className="flex gap-2 flex-wrap">{urls.slice(0, 8).map((u) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={u} src={u} alt="" className="w-16 h-16 object-cover rounded border" />
      ))}</div>
    ) : <p className="text-sm text-gray-500 italic">Example — replace me: upload your own photos in Edit listing.</p>;
  }
  if (s.key === "faqs") return <dl className="text-sm space-y-2">{((s.value as Faq[]) ?? []).map((f, i) => <div key={i}><dt className="font-medium">{f.q}</dt><dd className="text-gray-700">{f.a}</dd></div>)}</dl>;
  if (Array.isArray(s.value)) return <ul className="list-disc pl-5 text-sm">{(s.value as string[]).map((x, i) => <li key={i}>{x}</li>)}</ul>;
  return <p className="text-sm whitespace-pre-line">{String(s.value ?? "")}</p>;
}

export default function ContentKit({
  slug, mode, autoOpen, onModeChange,
}: {
  slug: string; mode: "A" | "B" | null; autoOpen: boolean; onModeChange: (m: "A" | "B") => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<KitDraft | null>(null);
  const [preview, setPreview] = useState<{ publish: SectionKey[]; blocked: SectionKey[] } | null>(null);
  const [editing, setEditing] = useState<SectionKey | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(autoOpen);

  const load = useCallback(async () => {
    const r = await fetch(`/api/owner/leads-plus/kit?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    setDraft(d.draft); setPreview(d.preview);
  }, [slug]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  useEffect(() => { if (autoOpen) document.getElementById("content-kit")?.scrollIntoView({ behavior: "smooth" }); }, [autoOpen]);

  async function post(body: object) {
    setBusy(true); setNote("");
    const r = await fetch("/api/owner/leads-plus/kit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...body }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setNote(d.error || "Something went wrong."); return null; }
    if (d.draft) setDraft(d.draft);
    if (d.preview) setPreview(d.preview);
    return d;
  }

  const sections = draft ? SECTION_ORDER.map((k) => draft.sections.find((s) => s.key === k)).filter(Boolean) as KitSection[] : [];
  const profile = draft?.profile ?? "trade";

  return (
    <div id="content-kit" className="space-y-3" data-testid="content-kit">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Your page content</h3>
        {!open && <button type="button" className="text-sm underline" onClick={() => setOpen(true)}>Open content kit</button>}
      </div>

      {/* First kit question → Mode A / B (switchable later) */}
      <div className="bg-gray-50 border rounded p-3 text-sm" data-testid="kit-mode-question">
        <p className="font-medium">Do you have a website you&apos;re happy with?</p>
        <div className="flex gap-2 mt-2">
          <button type="button" disabled={busy} onClick={() => void onModeChange("B")}
            className={`px-3 py-1.5 rounded border ${mode === "B" ? "text-white" : "bg-white"}`} style={mode === "B" ? { backgroundColor: primary } : {}}>
            Yes — send people to it
          </button>
          <button type="button" disabled={busy} onClick={() => void onModeChange("A")}
            className={`px-3 py-1.5 rounded border ${mode === "A" ? "text-white" : "bg-white"}`} style={mode === "A" ? { backgroundColor: primary } : {}}>
            No — this page is my website
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {mode === "B" ? "Your page shows “Visit our website” next to “Get a quote”." : mode === "A" ? "Your page leads with “Get a quote” and “Call”." : "You can change this any time."}
        </p>
      </div>

      {open && draft && (
        <>
          <div className="flex gap-2 flex-wrap">
            <button type="button" disabled={busy} onClick={() => void post({ action: "apply", op: "accept_all_listing" })} className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50" data-testid="kit-accept-all">
              Accept all from your listing
            </button>
            <button type="button" disabled={busy} onClick={async () => {
              const d = await post({ action: "suggest" });
              if (d) setNote(d.dropped?.length ? `Drafted suggestions. ${d.dropped.length} suggestion(s) were dropped because they mentioned something not in your listing.` : "Drafted suggestions from your listing — review each one.");
            }} className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50" data-testid="kit-suggest">
              Draft suggestions for me
            </button>
          </div>
          <p className="text-xs text-gray-500">
            <span className={`px-1 rounded ${LABEL_STYLE.listing}`}>{LABEL_TEXT.listing}</span> = facts already on your listing ·{" "}
            <span className={`px-1 rounded ${LABEL_STYLE.suggested}`}>{LABEL_TEXT.suggested}</span> = our rewrite of your facts (nothing added) ·{" "}
            <span className={`px-1 rounded ${LABEL_STYLE.example}`}>{LABEL_TEXT.example}</span> = never published.
          </p>
          {sections.map((s) => (
            <div key={s.key} className={`border rounded p-3 ${s.status === "deleted" ? "opacity-50" : ""}`} data-testid={`kit-section-${s.key}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{sectionTitle(s.key, profile)}</span>
                  <span className={`text-[11px] px-1.5 rounded ${LABEL_STYLE[s.label]}`} data-testid="kit-label">{LABEL_TEXT[s.label]}</span>
                  {s.status === "accepted" && <span className="text-[11px] text-green-700">✓ accepted</span>}
                  {s.status === "deleted" && <span className="text-[11px] text-gray-500">deleted</span>}
                </div>
                <div className="flex gap-1 text-xs">
                  {s.label !== "example" && s.status !== "accepted" && <button type="button" className="px-2 py-1 border rounded" disabled={busy} onClick={() => void post({ action: "apply", op: "accept", key: s.key })}>Accept</button>}
                  {(s.key !== "hours" || hoursEditable(profile)) && s.key !== "photos" && s.key !== "contact_prefs" && (
                    <button type="button" className="px-2 py-1 border rounded" disabled={busy} onClick={() => { setEditing(s.key); setText(s.label === "example" ? "" : toText(s.key, s.value)); }}>
                      {s.label === "example" || (s.key === "hours" && s.value == null) ? "Replace" : "Edit"}
                    </button>
                  )}
                  {s.status !== "deleted" && <button type="button" className="px-2 py-1 border rounded" disabled={busy} onClick={() => void post({ action: "apply", op: "delete", key: s.key })}>Delete</button>}
                </div>
              </div>
              <div className="mt-2">
                {editing === s.key ? (
                  <div className="space-y-2">
                    <textarea className="w-full border rounded p-2 text-sm" rows={s.key === "faqs" ? 6 : 4} value={text} onChange={(e) => setText(e.target.value)}
                      placeholder={s.key === "faqs" ? "Q: question\nA: answer\n\nQ: …" : s.key === "description" ? "Your description" : "One per line"} />
                    <div className="flex gap-2">
                      <button type="button" className="px-3 py-1 rounded text-white text-sm" style={{ backgroundColor: primary }} disabled={busy}
                        onClick={async () => { await post({ action: "apply", op: s.label === "example" ? "replace" : "edit", key: s.key, value: fromText(s.key, text) }); setEditing(null); }}>Save</button>
                      <button type="button" className="px-3 py-1 rounded border text-sm" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                ) : s.key === "contact_prefs" ? (
                  <p className="text-sm">Buttons on your page: {((s.value as string[]) ?? []).join(", ") || "none"}</p>
                ) : <Value s={s} lodgingHint={profile === "lodging" || profile === "campground"} outdoorHint={profile === "outdoor"} />}
                {s.provenance && s.label === "suggested" && <p className="text-[11px] text-gray-500 mt-1">Built from: {s.provenance.join(", ")}</p>}
              </div>
            </div>
          ))}
          {preview && (
            <div className="bg-gray-50 border rounded p-3 text-sm" data-testid="kit-publish-preview">
              <p>Will publish: {preview.publish.length ? preview.publish.map((k) => sectionTitle(k, profile)).join(", ") : "nothing yet — accept some sections first"}.</p>
              {preview.blocked.length > 0 && <p className="text-amber-800">Not published until you replace the example: {preview.blocked.map((k) => sectionTitle(k, profile)).join(", ")}.</p>}
            </div>
          )}
          <button type="button" disabled={busy || !preview?.publish.length} data-testid="kit-publish"
            onClick={async () => { const d = await post({ action: "publish" }); if (d?.ok) setNote("Published. Your page updates within a minute."); }}
            className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: primary }}>
            Approve &amp; publish
          </button>
        </>
      )}
      {note && <p className="text-sm" role="status">{note}</p>}
    </div>
  );
}
