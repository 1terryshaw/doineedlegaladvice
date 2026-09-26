import type { OwnerGbpStatus } from "@/lib/owner-gbp-status";

// claimant-edit-ux-stamp-v1 (R1): the Edit Listing GBP section. Status + a link to the
// dashboard Connect card — it writes nothing. `connectHref` is null on a site with no
// Connect card, and the owner is told to contact us instead of being sent nowhere.
export default function GbpStatusCard({
  status,
  connectHref,
}: {
  status: OwnerGbpStatus;
  connectHref: string | null;
}) {
  const label =
    status.state === "reviews_on"
      ? "✓ Google connected"
      : status.state === "reviews_unavailable"
        ? "✓ Google connected — reviews not available yet"
        : "Not connected";
  const tone =
    status.state === "reviews_on"
      ? "border-green-200 bg-green-50"
      : status.state === "reviews_unavailable"
        ? "border-amber-200 bg-amber-50"
        : "border-gray-200 bg-gray-50";
  const detail =
    status.state === "reviews_unavailable"
      ? status.reason
      : status.state === "not_connected"
        ? status.linkOnFile
          ? "A Google link is on file but isn't connected yet. You can connect it from your dashboard."
          : "Connect your Google Business Profile so customers can find your Google rating."
        : "Your Google rating can show on your listing.";
  const action =
    status.state === "reviews_on" ? "Manage on dashboard →" : status.state === "not_connected" ? "Connect on dashboard →" : "Fix on dashboard →";

  return (
    <section id="google-business-profile" className={`rounded-lg border p-4 ${tone}`} aria-labelledby="gbp-status-heading">
      <h2 id="gbp-status-heading" className="text-sm font-semibold text-gray-800">
        Your Google Business Profile: <span className="font-bold">{label}</span>
      </h2>
      <p className="mt-1 text-sm text-gray-600">{detail}</p>
      {connectHref ? (
        <a href={connectHref} className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline">
          {action}
        </a>
      ) : (
        <p className="mt-2 text-sm text-gray-600">Contact us to connect your Google Business Profile.</p>
      )}
    </section>
  );
}
