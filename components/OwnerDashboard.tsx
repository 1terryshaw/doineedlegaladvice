// pricing-version: 2026-05-12-usd-v2
"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import { Listing } from "@/lib/supabase";
import { can, getTierDisplayName, getNextTier, TierSlug } from "@/lib/tier-capabilities";
import { TIERS } from "@/lib/pricing-canonical";
import UpgradeReturnRefresher from "./UpgradeReturnRefresher";

// Type-erase config for fields that only some verticals define
const vc = verticalConfig as unknown as {
  primaryColor: string;
  ctaColor?: string;
  supportEmail?: string;
};
const CTA_COLOR = vc.ctaColor || vc.primaryColor;
const SUPPORT_EMAIL = vc.supportEmail || "support@example.com";

type TierPillColors = { bg: string; text: string; border: string };

function tierPillStyle(tier: string): TierPillColors {
  switch (tier) {
    case "growth":
      return { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" };
    case "website":
      return { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" };
    case "reviews_plus":
      return { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
    case "payment_error_review":
      return { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" };
    default:
      return { bg: "#f3f4f6", text: "#374151", border: "#d1d5db" };
  }
}

function formatPrice(tier: TierSlug | null): string {
  const t = tier === "reviews_plus" || tier === "website"
    ? TIERS[tier]
    : null;
  return t ? `$${t.priceMonthlyUSD} USD/mo` : "";
}

export default function OwnerDashboard({ listing, reviewSlot, healthSlot }: { listing: Listing; reviewSlot?: ReactNode; healthSlot?: ReactNode }) {
  const tier = (listing.tier || listing.subscription_tier || "free") as TierSlug;
  const tierLabel = getTierDisplayName(tier);
  const nextTier = getNextTier(tier);
  const pill = tierPillStyle(tier);

  const [siteforgeUrl, setSiteforgeUrl] = useState<string>(listing.siteforge_url || "");
  const [siteforgeStatus, setSiteforgeStatus] = useState<string>(listing.siteforge_status || "pending");
  const [savingUrl, setSavingUrl] = useState(false);
  const [customDomain, setCustomDomain] = useState<string>(listing.custom_domain || "");
  const [savingDomain, setSavingDomain] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string>("");

  async function handleLogout() {
    await fetch("/api/owner/logout", { method: "POST" });
    window.location.href = "/owner/login";
  }

  async function saveField(field: "siteforge_url" | "custom_domain", value: string) {
    const setSaving = field === "siteforge_url" ? setSavingUrl : setSavingDomain;
    setSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch("/api/owner/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: listing.slug, [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSaveMessage("Saved.");
      if (field === "siteforge_url" && value.trim().length > 0 && /^https?:\/\//i.test(value)) {
        setSiteforgeStatus("live");
      } else if (field === "siteforge_url" && value.trim().length === 0) {
        setSiteforgeStatus("pending");
      }
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(""), 3000);
    }
  }

  async function handleRefreshReviews() {
    setRefreshing(true);
    setRefreshResult("");
    try {
      const res = await fetch(`/api/reviews/refresh/${listing.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      setRefreshResult(`Refreshed — ${data.reviewCount ?? "?"} reviews cached.`);
    } catch (err) {
      setRefreshResult(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshResult(""), 6000);
    }
  }

  return (
    <div className="space-y-6">
      <UpgradeReturnRefresher />
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{listing.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border"
              style={{ backgroundColor: pill.bg, color: pill.text, borderColor: pill.border }}
            >
              ✓ {tierLabel} tier
            </span>
            {tier !== "free" && tier !== "seed" && tier !== "payment_error_review" && (
              <span className="text-xs text-gray-500">{formatPrice(tier)}</span>
            )}
          </div>
        </div>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">
          Logout
        </button>
      </div>

      {/* Payment error banner */}
      {tier === "payment_error_review" && (
        <div className="border border-red-300 bg-red-50 rounded-lg p-4">
          <p className="font-semibold text-red-900">⚠️ Payment issue detected</p>
          <p className="text-sm text-red-800 mt-1">
            Please update your payment method via Manage Billing below. Contact
            {" "}{SUPPORT_EMAIL}{" "}if you need help.
          </p>
        </div>
      )}

      {/* Free / seed / claimed — Upgrade to Reviews CTA */}
      {(tier === "free" || tier === "seed") && (
        <div className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Upgrade</p>
          <h2 className="text-xl font-bold mt-1">Unlock Reviews Plus — ${TIERS.reviews_plus.priceMonthlyUSD} USD/mo</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
            {TIERS.reviews_plus.visibleFeatures.map((f, i) => (
              <li key={i}>✓ {f}</li>
            ))}
          </ul>
          <Link
            href={`/directory/${listing.slug}?upgrade=true`}
            className="inline-block mt-4 px-5 py-2.5 rounded-lg text-white text-sm font-semibold"
            style={{ backgroundColor: CTA_COLOR }}
          >
            Upgrade to Reviews Plus →
          </Link>
        </div>
      )}

      {/* Reviews Plus tier — Upgrade to Website teaser (includes SiteForge info panel) */}
      {tier === "reviews_plus" && (
        <div className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-6">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Upgrade</p>
          <h2 className="text-xl font-bold mt-1">Unlock Website tier — ${TIERS.website.priceMonthlyUSD} USD/mo</h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <ul className="space-y-1.5 text-sm text-gray-700">
              {TIERS.website.visibleFeatures.map((f, i) => (
                <li key={i}>✓ {f}</li>
              ))}
            </ul>
            <div className="bg-white/60 rounded-md p-4 text-xs text-gray-600 border border-purple-200">
              <p className="font-semibold text-purple-900 mb-1">What&apos;s a SiteForge website?</p>
              <p>A full professional site generated for your business — services, gallery,
                contact form — delivered in 7 days. Your existing
                website stays untouched.</p>
            </div>
          </div>
          <Link
            href={`/directory/${listing.slug}?upgrade=true`}
            className="inline-block mt-4 px-5 py-2.5 rounded-lg text-white text-sm font-semibold"
            style={{ backgroundColor: CTA_COLOR }}
          >
            Upgrade to Website →
          </Link>
        </div>
      )}

      {/* Optional review slot (vertical-customized review section) — see TDL #254 */}
      {reviewSlot}

      {/* Recent Leads — reviews_plus+ tiers */}
      {can(tier, "lead_forwarding") && <RecentLeads />}

      {/* Listing health score — paid tiers (Reviews Plus feature) */}
      {can(tier, "analytics") && healthSlot}

      {/* SiteForge section — website + growth tiers */}
      {can(tier, "siteforge") && (
        <div className="border rounded-lg p-6">
          <h3 className="font-semibold mb-3">Your SiteForge website</h3>

          {siteforgeStatus === "live" && listing.siteforge_url && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4 text-sm text-green-800">
              ✅ Your site is live.{" "}
              <a
                href={listing.siteforge_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline"
              >
                View your site →
              </a>
            </div>
          )}

          {siteforgeStatus === "generating" && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4 text-sm text-amber-900">
              ⚙️ Building your site…
            </div>
          )}

          {(siteforgeStatus === "pending" || !siteforgeStatus) && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4 text-sm text-gray-700">
              🏗️ Your SiteForge site is being prepared. You&apos;ll receive an email when it&apos;s
              ready (typically within 24 hours).
            </div>
          )}

          {siteforgeStatus === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-sm text-red-800">
              ⚠️ We hit a snag generating your site. Our team has been notified. Contact
              {" "}{SUPPORT_EMAIL}{" "}if you haven&apos;t heard from us within 24 hours.
            </div>
          )}

          <label className="block text-xs font-medium text-gray-600 mb-1">SiteForge URL</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={siteforgeUrl}
              onChange={(e) => setSiteforgeUrl(e.target.value)}
              placeholder="https://your-siteforge-url.com"
              className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={() => saveField("siteforge_url", siteforgeUrl)}
              disabled={savingUrl}
              className="px-4 py-2 rounded text-white text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: verticalConfig.primaryColor }}
            >
              {savingUrl ? "Saving…" : "Save"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Saving a valid URL flips the status to &ldquo;live&rdquo; and shows the
            &ldquo;View Your Full Site&rdquo; CTA on your public listing.
          </p>
          {saveMessage && <p className="mt-2 text-xs text-gray-700">{saveMessage}</p>}
        </div>
      )}

      {/* Custom domain — growth only */}
      {can(tier, "custom_domain") && (
        <div className="border rounded-lg p-6">
          <h3 className="font-semibold mb-3">Custom domain (Growth)</h3>
          <p className="text-xs text-gray-600 mb-3">
            Point your domain&apos;s CNAME to cname.vercel-dns.com, then enter it below.
            We&apos;ll use it as your canonical listing URL.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="yourdomain.com"
              className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              onClick={() => saveField("custom_domain", customDomain)}
              disabled={savingDomain}
              className="px-4 py-2 rounded text-white text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: verticalConfig.primaryColor }}
            >
              {savingDomain ? "Saving…" : "Save"}
            </button>
          </div>
          {saveMessage && <p className="mt-2 text-xs text-gray-700">{saveMessage}</p>}
        </div>
      )}

      {/* Reviews refresh — reviews + above */}
      {can(tier, "reviews_display") && (
        <div className="border rounded-lg p-6">
          <h3 className="font-semibold mb-2">Google reviews</h3>
          <p className="text-xs text-gray-600 mb-3">
            Click below to refresh your Google reviews.
          </p>
          <button
            onClick={handleRefreshReviews}
            disabled={refreshing}
            className="px-4 py-2 border rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh Google reviews now"}
          </button>
          {refreshResult && <p className="mt-2 text-xs text-gray-700">{refreshResult}</p>}
        </div>
      )}

      {/* Listing details + billing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Listing details</h3>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-gray-500">Name</dt><dd>{listing.name}</dd></div>
            <div><dt className="text-gray-500">City</dt><dd>{listing.city || "Not set"}</dd></div>
            <div><dt className="text-gray-500">Phone</dt><dd>{listing.phone || "Not set"}</dd></div>
            <div><dt className="text-gray-500">Email</dt><dd>{listing.email || "Not set"}</dd></div>
            <div><dt className="text-gray-500">Website</dt><dd>{listing.website || "Not set"}</dd></div>
          </dl>
          <Link
            href={`/owner/${listing.slug}/edit`}
            className="inline-block mt-4 px-4 py-2 rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: verticalConfig.primaryColor }}
          >
            Edit listing
          </Link>
        </div>

        <div className="border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Billing</h3>
          <p className="text-sm text-gray-600">
            Current: <span className="font-medium">{tierLabel}{tier !== "free" && tier !== "seed" ? ` — ${formatPrice(tier)}` : ""}</span>
          </p>
          {listing.stripe_subscription_id ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <form action="/api/billing-portal-redirect" method="POST">
                <button type="submit" className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
                  Manage billing
                </button>
              </form>
              <form
                action="/api/billing-portal-redirect"
                method="POST"
                onSubmit={(e) => {
                  if (!window.confirm(
                    `Cancel your ${tierLabel} subscription? Your listing data will be preserved and you can re-subscribe anytime. You'll keep ${tierLabel} features until the end of the current billing period.`
                  )) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="action" value="cancel" />
                <button
                  type="submit"
                  className="px-4 py-2 border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50"
                >
                  Cancel subscription
                </button>
              </form>
            </div>
          ) : (
            <Link
              href={`/directory/${listing.slug}?upgrade=true`}
              className="inline-block mt-4 text-sm font-medium hover:underline"
              style={{ color: verticalConfig.primaryColor }}
            >
              {nextTier ? `Upgrade to ${getTierDisplayName(nextTier)} →` : "View pricing →"}
            </Link>
          )}
        </div>
      </div>

      {/* Analytics placeholder — paid tiers only */}
      {can(tier, "analytics") && (
        <div className="border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Analytics (last 30 days)</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">—</div>
              <div className="text-xs text-gray-500 mt-1">Listing views</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">—</div>
              <div className="text-xs text-gray-500 mt-1">Inquiries</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">—</div>
              <div className="text-xs text-gray-500 mt-1">Profile clicks</div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Detailed analytics coming soon.</p>
        </div>
      )}

      {/* Public listing link */}
      <div className="border rounded-lg p-6">
        <h3 className="font-semibold mb-2">Public listing</h3>
        <Link
          href={`/directory/${listing.slug}`}
          className="text-sm hover:underline"
          style={{ color: verticalConfig.primaryColor }}
        >
          View your public listing page →
        </Link>
      </div>
    </div>
  );
}

// ── Recent Leads sub-component ────────────────────────────────────────
type Lead = {
  id: string;
  visitor_name: string;
  visitor_email: string;
  visitor_phone?: string;
  message?: string;
  service_needed?: string;
  urgency?: string;
  delivery_status?: string;
  created_at: string;
};

function RecentLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/owner/leads")
      .then((r) => r.json())
      .then((d) => setLeads(d.leads || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  const urgencyStyle: Record<string, string> = {
    emergency: "bg-red-100 text-red-800",
    urgent: "bg-amber-100 text-amber-800",
    flexible: "bg-gray-100 text-gray-600",
  };

  const statusIcon: Record<string, string> = {
    both_sent: "✅",
    email_sent: "📧",
    sms_sent: "📱",
    failed: "❌",
    pending: "⏳",
  };

  return (
    <div className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6">
      <h3 className="font-semibold text-lg mb-1">Recent Leads</h3>
      <p className="text-xs text-gray-500 mb-4">
        Leads from your contact form, forwarded to you via email + SMS.
      </p>

      {loading && (
        <p className="text-sm text-gray-500">Loading leads...</p>
      )}

      {!loading && leads.length === 0 && (
        <div className="text-center py-6">
          <p className="text-gray-500 text-sm">No leads yet.</p>
          <p className="text-gray-400 text-xs mt-1">
            Leads will appear here within seconds of a visitor submitting your
            contact form.
          </p>
        </div>
      )}

      {!loading && leads.length > 0 && (
        <div className="space-y-2">
          {leads.map((lead) => (
            <div key={lead.id} className="bg-white rounded-lg border p-3">
              <button
                onClick={() =>
                  setExpanded(expanded === lead.id ? null : lead.id)
                }
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {lead.visitor_name}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${urgencyStyle[lead.urgency || "flexible"]}`}
                    >
                      {lead.urgency || "flexible"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>
                      {statusIcon[lead.delivery_status || "pending"]}
                    </span>
                    <span>{timeAgo(lead.created_at)}</span>
                  </div>
                </div>
                {lead.service_needed && (
                  <p className="text-xs text-gray-500 mt-1">
                    {lead.service_needed}
                  </p>
                )}
                {lead.message && (
                  <p className="text-xs text-gray-600 mt-1 truncate">
                    {lead.message}
                  </p>
                )}
              </button>

              {expanded === lead.id && (
                <div className="mt-3 pt-3 border-t text-sm space-y-1">
                  <p>
                    <span className="text-gray-500">Email:</span>{" "}
                    <a
                      href={`mailto:${lead.visitor_email}`}
                      className="text-blue-600 hover:underline"
                    >
                      {lead.visitor_email}
                    </a>
                  </p>
                  {lead.visitor_phone && (
                    <p>
                      <span className="text-gray-500">Phone:</span>{" "}
                      <a
                        href={`tel:${lead.visitor_phone}`}
                        className="text-blue-600 hover:underline"
                      >
                        {lead.visitor_phone}
                      </a>
                    </p>
                  )}
                  {lead.message && (
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {lead.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
