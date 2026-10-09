"use client";

// leads-plus-canary-v1 — Call / Email / Visit website / WhatsApp. Each tap is COUNTED (beacon to
// /api/leads-plus/tap); a tap is never a lead. WhatsApp only renders when the owner set a number.
// Mode A: primary CTA = Get a quote / Call.  Mode B: "Visit our website" at equal weight, followable.
import verticalConfig from "@/lib/vertical.config";

const primary = (verticalConfig as { primaryColor: string }).primaryColor;

function tap(slug: string, kind: string) {
  try {
    const body = JSON.stringify({ listingSlug: slug, kind });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/leads-plus/tap", new Blob([body], { type: "application/json" }));
    else void fetch("/api/leads-plus/tap", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
  } catch { /* counting must never break a click */ }
}

export default function LeadsPlusButtons({
  slug, mode, phone, email, website, whatsapp, variant = "hero",
}: {
  slug: string;
  mode: "A" | "B";
  phone: string | null;
  email: string | null;
  website: string | null; // already vetted: linkable (not dead/parked) and owner-enabled
  whatsapp: string | null; // digits only
  variant?: "hero" | "sidebar";
}) {
  const solid = "flex-1 min-w-[8rem] text-center py-3 px-4 rounded-lg font-semibold text-white";
  const outline = "flex-1 min-w-[8rem] text-center py-3 px-4 rounded-lg font-semibold border-2 bg-white";
  const tel = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;
  const modeB = mode === "B" && !!website;

  return (
    <div className={variant === "hero" ? "flex flex-wrap gap-2" : "flex flex-col gap-2"} data-testid={`leads-plus-buttons-${variant}`} data-mode={modeB ? "B" : "A"}>
      {modeB ? (
        <>
          <a href={website!} target="_blank" rel="noopener" onClick={() => tap(slug, "website")} className={solid} style={{ backgroundColor: primary }} data-testid="cta-website">
            Visit our website
          </a>
          <a href="#get-a-quote" className={solid} style={{ backgroundColor: primary }} data-testid="cta-quote">Get a quote</a>
          {tel && <a href={tel} onClick={() => tap(slug, "call")} className={outline} style={{ borderColor: primary, color: primary }} data-testid="cta-call">Call</a>}
        </>
      ) : (
        <>
          <a href="#get-a-quote" className={solid} style={{ backgroundColor: primary }} data-testid="cta-quote">Get a quote</a>
          {tel && <a href={tel} onClick={() => tap(slug, "call")} className={solid} style={{ backgroundColor: primary }} data-testid="cta-call">Call</a>}
          {website && (
            <a href={website} target="_blank" rel="noopener" onClick={() => tap(slug, "website")} className={outline} style={{ borderColor: primary, color: primary }} data-testid="cta-website">
              Visit website
            </a>
          )}
        </>
      )}
      {email && (
        <a href={`mailto:${email}`} onClick={() => tap(slug, "email")} className={outline} style={{ borderColor: primary, color: primary }} data-testid="cta-email">Email</a>
      )}
      {whatsapp && (
        <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener" onClick={() => tap(slug, "whatsapp")} className={outline} style={{ borderColor: "#25D366", color: "#128C7E" }} data-testid="cta-whatsapp">
          WhatsApp
        </a>
      )}
    </div>
  );
}
