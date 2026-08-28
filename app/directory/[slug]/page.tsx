import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListing } from "@/lib/supabase";
import { getEnrichment } from "@/lib/knowledge";
import EnrichmentBlock from "@/components/EnrichmentBlock";
import verticalConfig from "@/lib/vertical.config";
import InquiryForm from "@/components/InquiryForm";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import UpgradeModal from "@/components/UpgradeModal";
import { can } from "@/lib/tier-capabilities";
import { listPhotosForListing } from "@/lib/listing-photos";
import {
  DAY_KEYS,
  DAY_LABELS,
  HoursJson,
  formatHoursLine,
  buildOpeningHoursSpec,
} from "@/lib/listing-extras";
import { canonical } from "@/lib/vertical-canonical";
import ListingGallery from "@/components/ListingGallery";
import TierBadge from "@/components/TierBadge";
import ReviewShowcase from "@/components/ReviewShowcase";
import FaqSection from "@/components/FaqSection";
import { detailBreadcrumbSchema, localizeFaqs, OG_DEFAULT_IMAGE } from "@/lib/seo";
import { getRegionBySlug } from "@/lib/constants";
import ListingClaimCTA from "@/components/ListingClaimCTA";
import ClaimUnlockPreview from "@/components/ClaimUnlockPreview";
import PublicGbpClaimSidecar from "@/components/PublicGbpClaimSidecar";
import { normalizeTierForPricing } from "@/lib/pricing-canonical";
import { HAS_LIST_YOUR_BUSINESS } from "@/lib/add-business";

const LEGAL_DISCLAIMER =
  "The information here is for informational purposes only and is not legal advice. Consult a licensed attorney in your jurisdiction about your specific situation.";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) return { title: "Not Found" };
  return {
    title: listing.name,
    description: listing.short_description || listing.description,
    alternates: { canonical: `/directory/${slug}` },
    openGraph: { images: [OG_DEFAULT_IMAGE] },
  };
}

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) notFound();
  // Supplementary AI enrichment (fail-open: null on any error => page renders normally).
  const enrichment = await getEnrichment("lawyer", listing.slug);
  const { photos, logo } = await listPhotosForListing(listing.id);
  const lst = listing as typeof listing & {
    hours_json?: HoursJson | null;
    services?: string[] | null;
    service_area?: string[] | null;
    gbp_url?: string | null;
    year_established?: number | null;
    social_instagram?: string | null;
    social_facebook?: string | null;
    social_linkedin?: string | null;
  };
  const hours = (lst.hours_json as HoursJson | null) ?? null;
  const services = lst.services ?? [];
  const serviceArea = lst.service_area ?? [];
  const sameAsLinks = [
    lst.gbp_url,
    lst.social_instagram,
    lst.social_facebook,
    lst.social_linkedin,
  ].filter((u): u is string => Boolean(u && u.trim()));
  const heroColumnUrl =
    (listing as { hero_image_url?: string | null }).hero_image_url ?? null;
  // Dedicated hero set -> all photos go to the gallery; else photos[0] is the hero.
  const heroImageUrl = heroColumnUrl ?? photos[0]?.public_url ?? null;
  const galleryPhotos = heroColumnUrl ? photos : photos.slice(1);


  const tier = (listing.tier as string | null) ?? (listing.subscription_tier as string | null) ?? 'seed';
  const placeId =
    (listing as typeof listing & { google_place_id?: string }).google_place_id ?? null;

  // TDL #791/#803 — registry-harvested emails (e.g. fl_bar_registry, il_ardc_registry)
  // are BACKEND-ONLY: never surfaced on the public page or in JSON-LD, pending separate
  // per-source ToS review. Owner-provided / non-registry emails render as before.
  const REGISTRY_EMAIL_SOURCES = new Set(["fl_bar_registry", "il_ardc_registry"]);
  const emailSource = (listing as { email_source?: string | null }).email_source ?? null;
  const publicEmail =
    listing.email && !(emailSource && REGISTRY_EMAIL_SOURCES.has(emailSource))
      ? listing.email
      : null;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LegalService",
    name: listing.name,
    description: listing.short_description || listing.description,
    telephone: listing.phone,
    email: publicEmail,
    // Conditional, NOT `url: listing.website`. JSON.stringify drops `undefined` but KEEPS `null`,
    // so an unconditional key emits `"url":null` for any row whose website is null — invalid
    // schema.org. The Arc-2 dead-website cleanup nulled 38,669 websites fleet-wide, so this is
    // now common rather than theoretical. The outbound <a> below is already guarded.
    ...(listing.website && { url: listing.website }),
    address: {
      "@type": "PostalAddress",
      addressLocality: listing.city,
      addressRegion: listing.province_state,
      addressCountry: listing.country || verticalConfig.defaultCountry,
    },
    ...(listing.google_rating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: listing.google_rating,
        reviewCount: listing.google_review_count,
      },
    }),
      ...(photos.length > 0 && { image: photos.map((p) => p.public_url) }),
    ...(logo && { logo: logo.public_url }),
    ...(hours && { openingHoursSpecification: buildOpeningHoursSpec(hours) }),
    ...(services.length > 0 && {
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Services",
        itemListElement: services.map((s) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: s },
        })),
      },
    }),
    ...(serviceArea.length > 0 && {
      areaServed: serviceArea.map((c) => ({ "@type": "City", name: c })),
    }),
    ...(lst.year_established && { foundingDate: String(lst.year_established) }),
    ...(sameAsLinks.length > 0 && { sameAs: sameAsLinks }),
};

  // Safe JSON-LD upgrades from AI enrichment. Additive expertise signals (knowsAbout,
  // availableLanguage) plus GAP-FILL only for areaServed/description/foundingDate — authoritative
  // listing data is never overridden (claimed > original > enrichment).
  if (enrichment) {
    const k = enrichment.knowledge;
    const knowsAbout = Array.from(new Set([...k.services, ...k.specialties, ...k.certifications]))
      .filter((s) => s && s.trim())
      .slice(0, 30);
    if (knowsAbout.length > 0 && !jsonLd.knowsAbout) jsonLd.knowsAbout = knowsAbout;
    if (k.languages.length > 0 && !jsonLd.availableLanguage) jsonLd.availableLanguage = k.languages;
    if (!jsonLd.areaServed && k.service_areas.length > 0) {
      jsonLd.areaServed = k.service_areas.map((c) => ({ "@type": "City", name: c }));
    }
    if (!jsonLd.description && k.description) jsonLd.description = k.description;
    if (!jsonLd.foundingDate && k.year_established && /^\d{4}$/.test(k.year_established)) {
      jsonLd.foundingDate = k.year_established;
    }
  }

  // BreadcrumbList JSON-LD (SEPARATE block — the LegalService object above is
  // untouched). Static-config US-state: trail is Home → /{stateSlug} hub → business,
  // where the state crumb is included only when province_state resolves to a
  // configured region hub (getRegionBySlug) so the emitted URL always 200s.
  const bcStateSlug = (listing.province_state || "").trim().toLowerCase();
  const bcRegion = bcStateSlug ? getRegionBySlug(bcStateSlug) : null;
  const breadcrumbTrail: Array<{ name: string; path: string }> = [
    { name: "Home", path: "/" },
  ];
  if (bcRegion) {
    const bcName =
      (bcRegion as { name?: string; label?: string }).name ||
      (bcRegion as { label?: string }).label ||
      bcStateSlug.toUpperCase();
    breadcrumbTrail.push({ name: bcName, path: `/${bcStateSlug}` });
  }
  breadcrumbTrail.push({ name: listing.name, path: `/directory/${listing.slug}` });
  const breadcrumbLd = detailBreadcrumbSchema(breadcrumbTrail);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-6">
          <LegalDisclaimer />
        </div>
        <Link href="/directory" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
          &larr; Back to directory
        </Link>


        {heroImageUrl && (
          <div className="mb-6 rounded-xl overflow-hidden bg-gray-100 max-h-[420px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImageUrl} alt={listing.name} className="w-full h-auto object-cover" />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="md:col-span-2">
            {can(tier, 'featured') && (
              <div className="mb-3 inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm" aria-label="Featured listing">
                <span aria-hidden="true">★</span>
                <span>FEATURED</span>
              </div>
            )}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {logo && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logo.public_url} alt="" className="w-14 h-14 rounded-lg object-cover border" />
                )}
                <div>
                  <h1 className="text-3xl font-bold">{listing.name}</h1>
                  {lst.year_established && (
                    <p className="text-xs text-gray-500 mt-1">Established {lst.year_established}</p>
                  )}
                </div>
              </div>
              <TierBadge
                tier={listing.tier}
                subscription_tier={listing.subscription_tier}
                is_claimed={listing.claimed} google_rating={listing.google_rating}
              />
              {listing.now_hiring && (
                <span className="bg-green-600 text-white text-xs font-medium px-2 py-0.5 rounded-full ml-2">Now Hiring</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-4">
              We don&apos;t vet or endorse listed businesses.
            </p>

            {listing.now_hiring && (
              <p className="text-sm text-green-700 mb-3">This business is currently hiring. Contact them directly to inquire about opportunities.</p>
            )}
            {listing.city && (
              <p className="text-gray-500 mb-4">
                {listing.city}{listing.province_state ? `, ${listing.province_state}` : ""}
              </p>
            )}

            {listing.google_rating && (
              <div className="flex items-center gap-1 text-sm text-gray-600 mb-6">
                <span className="text-yellow-500">&#9733;</span>
                <span>{listing.google_rating}</span>
                {listing.google_review_count && (
                  <span>({listing.google_review_count} reviews)</span>
                )}
              </div>
            )}

            <div className="prose max-w-none">
              <p>{listing.description}</p>
            </div>

            {/* Customer reviews — full carousel for tiers with reviews_display */}
            {can(tier, "reviews_display") && placeId && (
              <div className="mt-8 border-t pt-6">
                <h3 className="font-semibold mb-3">Customer Reviews</h3>
                <ReviewShowcase
                  googlePlaceId={placeId}
                  subscriptionTier={tier}
                  fallbackRating={listing.google_rating}
                  fallbackCount={listing.google_review_count}
                />
              </div>
            )}


            {/* Services */}
            {services.length > 0 && (
              <div className="mt-8 border-t pt-6">
                <h3 className="font-semibold mb-3">Services</h3>
                <div className="flex flex-wrap gap-2">
                  {services.map((s) => (
                    <span key={s} className="bg-blue-100 text-blue-800 text-sm rounded-full px-3 py-1">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Service area */}
            {serviceArea.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-2">Service area</h3>
                <p className="text-sm text-gray-700">Serving: {serviceArea.join(", ")}</p>
              </div>
            )}

            {/* Hours */}
            {hours && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Hours</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm max-w-sm">
                  {DAY_KEYS.map((day) => (
                    <div key={day} className="contents">
                      <dt className="text-gray-500">{DAY_LABELS[day]}</dt>
                      <dd className="text-gray-800">{formatHoursLine(hours[day])}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Additional Information — supplementary AI enrichment (distinct, attributed block) */}
            {enrichment && (
              <EnrichmentBlock
                enrichment={enrichment}
                listingHasDescription={Boolean(listing.short_description || listing.description)}
                listingHasServices={services.length > 0}
                listingHasServiceArea={serviceArea.length > 0}
              />
            )}

            {/* Photo gallery */}
            {galleryPhotos.length > 0 && (
              <div className="mt-8 border-t pt-6">
                <h3 className="font-semibold mb-3">Photos</h3>
                <ListingGallery
                  photos={galleryPhotos.map((p) => ({ id: p.id, public_url: p.public_url }))}
                />
              </div>
            )}
            {/* Contact info */}
            <div className="mt-8 border-t pt-6 space-y-2">
              <h3 className="font-semibold mb-3">Contact Information</h3>
              {listing.phone && <p className="text-sm"><span className="text-gray-500">Phone:</span> {listing.phone}</p>}
              {publicEmail && <p className="text-sm"><span className="text-gray-500">Email:</span> {publicEmail}</p>}
              {listing.website && (
                <p className="text-sm">
                  <span className="text-gray-500">Website:</span>{" "}
                  <a href={listing.website} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: verticalConfig.primaryColor }}>
                    {listing.website}
                  </a>
                </p>
              )}
            
              {lst.gbp_url && (
                <div className="pt-3">
                  <a
                    href={lst.gbp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    View on Google
                  </a>
                </div>
              )}

              {(lst.social_instagram || lst.social_facebook || lst.social_linkedin) && (
                <div className="pt-3 flex flex-wrap gap-3 text-sm">
                  {lst.social_instagram && (
                    <a href={lst.social_instagram} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:underline">
                      Instagram
                    </a>
                  )}
                  {lst.social_facebook && (
                    <a href={lst.social_facebook} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:underline">
                      Facebook
                    </a>
                  )}
                  {lst.social_linkedin && (
                    <a href={lst.social_linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:underline">
                      LinkedIn
                    </a>
                  )}
                </div>
              )}
</div>

            {/* Claim CTA — UNCLAIMED: server-rendered unlock-preview (visible JS-off,
                no client auth hook). CLAIMED: keep ListingClaimCTA for the owner's
                "Edit My Listing" affordance (anon sees nothing on claimed pages). */}
            <>{listing.claimed ? (
              <ListingClaimCTA
                listingSlug={listing.slug}
                listingClaimed={listing.claimed}
              />
            ) : (
              <ClaimUnlockPreview
                listingSlug={listing.slug}
                hasReviews={Number(listing.google_review_count) > 0}
              />
            )}
            {HAS_LIST_YOUR_BUSINESS && <p className="mt-4 text-sm text-gray-500">Run a different lawyer{listing.city ? ` in ${listing.city}` : ""}? <Link href="/list-your-business" className="underline" style={{ color: verticalConfig.primaryColor }}>Add your business &rarr;</Link></p>}</>
            <PublicGbpClaimSidecar
              listingSlug={listing.slug}
              listingName={listing.name}
              address={[(lst as { address?: string | null }).address, listing.city, listing.province_state, (lst as { postal_code?: string | null }).postal_code, listing.country].filter(Boolean).join(", ")}
              listingClaimed={listing.claimed}
            />
          </div>

          {/* Sidebar */}
          <div className="md:col-span-1 space-y-6">
            <div className="border rounded-lg p-6 sticky top-4">
              <InquiryForm listingSlug={listing.slug} />
            </div>
          </div>
        </div>
      </div>
      {/* FAQ — visible accordion + FAQPage ld+json (sibling block; LegalService +
          BreadcrumbList above untouched). Legal disclaimer above accordion. */}
      <FaqSection
        faqs={localizeFaqs(verticalConfig.faqs, listing.city)}
        disclaimer={LEGAL_DISCLAIMER}
      />
      <UpgradeModal
        listingSlug={listing.slug}
        priceIds={{
          reviews_plus_monthly: process.env.STRIPE_PRICE_REVIEWS_MONTHLY || "",
          reviews_plus_annual: process.env.STRIPE_PRICE_REVIEWS_ANNUAL || "",
          website_monthly: process.env.STRIPE_PRICE_WEBSITE_MONTHLY || "",
          website_annual: process.env.STRIPE_PRICE_WEBSITE_ANNUAL || "",
          growth_monthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY || "",
          growth_annual: process.env.STRIPE_PRICE_GROWTH_ANNUAL || "",
        }}
        currentTier={normalizeTierForPricing(listing.tier as string | null, listing.claimed)}
        currentCycle={null}
      />
    </>
  );
}
