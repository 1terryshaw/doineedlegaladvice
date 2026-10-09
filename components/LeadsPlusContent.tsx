// leads-plus-canary-v1 — owner-APPROVED kit content on the public page (R8: indexable only after
// owner approval). Renders only sections the page does not already render from listing columns
// (services / areas / hours / photos keep their existing blocks).
import { sectionTitle, type KitProfile, type PublishedKit } from "@/lib/content-kit";

// profile "lodging": the page has no services/hours columns of its own, so the approved Rooms & amenities and the owner's
// check-in / check-out wording render here. "trade" (default) renders exactly as before.
// leads-plus-fleet-fan-v1: "campground" / "outdoor" render like lodging under their own titles (Sites & amenities,
// Trips & packages, …). A TRADE page whose table has no services / service_area columns passes showServices / showAreas
// so approved services + areas are visible on the page (the Service JSON-LD must describe visible content).
export default function LeadsPlusContent({ kit, profile = "trade", showServices = false, showAreas = false }: {
  kit: PublishedKit; profile?: KitProfile; showServices?: boolean; showAreas?: boolean;
}) {
  const list = (title: string, items: string[] | undefined, testid: string) =>
    items && items.length > 0 ? (
      <div className="mt-8 border-t pt-6" data-testid={testid}>
        <h3 className="font-semibold mb-3">{title}</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-800">
          {items.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </div>
    ) : null;
  const ownSections = profile !== "trade";
  return (
    <>
      {profile === "lodging" && list("Rooms & amenities", kit.services, "kit-rooms")}
      {(profile === "campground" || profile === "outdoor") && list(sectionTitle("services", profile), kit.services, "kit-rooms")}
      {profile === "trade" && showServices && list("Services", kit.services, "kit-services")}
      {profile === "trade" && showAreas && list("Service areas", kit.service_areas, "kit-areas")}
      {ownSections && kit.stay_times && (
        <div className="mt-8 border-t pt-6" data-testid="kit-stay-times">
          <h3 className="font-semibold mb-3">{sectionTitle("hours", profile)}</h3>
          <p className="text-sm text-gray-800 whitespace-pre-line">{kit.stay_times}</p>
        </div>
      )}
      {list("Why choose us", kit.why_choose_us, "kit-why")}
      {list(profile === "lodging" ? "Rates" : profile === "trade" ? "Pricing" : sectionTitle("pricing", profile), kit.pricing, "kit-pricing")}
      {list("Offers", kit.offers, "kit-offers")}
      {kit.faqs && kit.faqs.length > 0 && (
        <div className="mt-8 border-t pt-6" data-testid="kit-faqs">
          <h3 className="font-semibold mb-3">Questions</h3>
          <dl className="space-y-3 text-sm">
            {kit.faqs.map((f, i) => (
              <div key={i}>
                <dt className="font-medium text-gray-900">{f.q}</dt>
                <dd className="text-gray-700 mt-0.5 whitespace-pre-line">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );
}
