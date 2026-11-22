import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListing } from "@/lib/supabase";
import { getEnrichment } from "@/lib/knowledge";
import { hasPublicStreet } from "@/lib/address-visibility";
import EnrichmentBlock from "@/components/EnrichmentBlock";
import verticalConfig from "@/lib/vertical.config";
import LeadsPlusForm from "@/components/LeadsPlusForm";
import LeadsPlusButtons from "@/components/LeadsPlusButtons";
import LeadsPlusContent from "@/components/LeadsPlusContent";
import { getLeadsPlusPublicCached } from "@/lib/leads-plus-server";
import { TEST_FIXTURE_SLUG_PREFIX } from "@/lib/leads-plus";
import { SITE_URL } from "@/lib/seo";
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
  normalizeHours,
} from "@/lib/listing-extras";
import { canonical } from "@/lib/vertical-canonical";
import ListingGallery from "@/components/ListingGallery";
import TierBadge from "@/components/TierBadge";
import ReviewShowcase from "@/components/ReviewShowcase";
import FaqSection from "@/components/FaqSection";
import { detailBreadcrumbSchema, localizeFaqs, OG_DEFAULT_IMAGE } from "@/lib/seo";
import { getRegionBySlug } from "@/lib/constants";
import ListingClaimCTA from "@/components/ListingClaimCTA";
import ListingOwnerClaimCard from "@/components/ListingOwnerClaimCard";
import ListingImage from "@/components/ListingImage";
import { listingPhotoUrl } from "@/lib/listing-photo-url";
import { normalizeWebsiteUrl } from "@/lib/url-normalize";
import { normalizeTierForPricing } from "@/lib/pricing-canonical";
import ListingStatsBeacon from "@/components/ListingStatsBeacon";

const LEGAL_DISCLAIMER =
  "The information here is for informational purposes only and is not legal advice. Consult a licensed attorney in your jurisdiction about your specific situation.";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) return { title: "Not Found" };
  // leads-plus-canary-v1: owner-APPROVED kit description (R8) only while the Leads Plus gate is open;
  // the reserved test fixture is never indexable.
  const lpMeta = await getLeadsPlusPublicCached(slug).catch(() => null);
  const kitDesc = lpMeta?.gate.ok ? lpMeta.kit?.description : undefined;
  return {
    ...(slug.startsWith(TEST_FIXTURE_SLUG_PREFIX) ? { robots: { index: false, follow: false } } : {}),
    title: listing.name,
    description: kitDesc || listing.short_description || listing.description,
    alternates: { canonical: `/directory/${slug}` },
    openGraph: { images: [OG_DEFAULT_IMAGE] },
  };
}

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) notFound();

  // ADDRESS SHOW/HIDE (Phase 2 fleet fan, 2026-09-04). Street fields read through ONE
  // narrowly-typed view: the repo's own `Listing` interface may or may not declare them,
  // and this neither widens nor fights it.
  const lstAddr = listing as { address?: string | null; postal_code?: string | null; show_address?: boolean | null };
  // ONE predicate, shared by the NAP block, the Maps link and the PostalAddress JSON-LD, so
  // the rendered page and the structured data can never disagree about whether a street is
  // public. UNIFORM CODE: grain sets only the COLUMN DEFAULT in the migration (business TRUE,
  // person/uncertain FALSE — K38, the address is often a home). No grain branch here.
  // The detail read has ALREADY nulled address/postal_code when the gate is off; this is the
  // readable statement of intent at the consumer, not the only thing holding the line.
  const streetPublic = hasPublicStreet(lstAddr);
  // STRUCTURED NAP FIELDS (Phase 1 fan, 2026-09-04). Read through ONE narrowly typed
  // view, the same way the address gate reads through `lstAddr`: this repo's own `Listing`
  // interface may or may not declare these columns, and this neither widens nor fights it.
  //
  // NO GATE HERE, DELIBERATELY. An employee count, a founding year and a list of payment
  // types are non-sensitive public business facts — they say nothing about where a person
  // lives. There is no grain split and no owner visibility toggle: the columns are NULL on
  // every seeded row and fill only when an owner saves the edit form.
  const napFacts = listing as {
    year_established?: number | null;
    employee_count?: number | null;
    payment_methods?: string | null;
  };
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
  // Normalised on read: a stored row may carry any subset of days (or a foreign shape);
  // only days that are actually set render. A missing day is "not set", never a crash.
  const hours = normalizeHours(lst.hours_json);
  const hourDays = hours ? DAY_KEYS.filter((d) => hours[d]) : [];
  const services = lst.services ?? [];
  const serviceArea = lst.service_area ?? [];
  const sameAsLinks = [
    lst.gbp_url,
    lst.social_instagram,
    lst.social_facebook,
    lst.social_linkedin,
  ].filter((u): u is string => Boolean(u && u.trim()));
  // Filter before assigning hero/gallery slots so invalid references never become img sources.
  const safePhotos = photos.flatMap((photo) => {
    const public_url = listingPhotoUrl(photo.public_url);
    return public_url ? [{ ...photo, public_url }] : [];
  });
  const logoUrl = listingPhotoUrl(logo?.public_url);
  const heroColumnUrl = listingPhotoUrl(
    (listing as { hero_image_url?: string | null }).hero_image_url
  );
  // Dedicated valid hero -> all valid photos go to the gallery; else the first is hero.
  const heroImageUrl = heroColumnUrl ?? safePhotos[0]?.public_url ?? null;
  const galleryPhotos = heroColumnUrl ? safePhotos : safePhotos.slice(1);


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

  // Stored websites can be bare domains ("collinslaw.com"); as an href that resolves relative to
  // /directory/ and 404s. Normalize to an absolute https URL; an unparseable value gets no link.
  const websiteHref = listing.website ? normalizeWebsiteUrl(listing.website).url : null;

  // leads-plus-canary-v1: ONE gate (claimed AND owner email confirmed AND leads_plus AND
  // leads_plus_enabled). Fail-open to today's page: any read error ⇒ null ⇒ gate closed.
  // TDL #1407 (legal-fla-retirement-v1, CEO R2/R4): DINLA is the ONE host for every legal row, US and CA.
  // The #1402 caOnDinla hand-off (claim/manage on FLA, no Leads Plus / GBP sidecar / upgrade modal) is
  // removed: claim, #1372 identity queue, owner dashboard and any Stripe entitlement all live here now.
  const lp = await getLeadsPlusPublicCached(listing.slug).catch(() => null);
  const lpOn = lp?.gate.ok === true;
  const lpKit = lpOn ? lp!.kit : null;
  const lpWebsite = lpOn && lp!.websiteOk ? (listing.website as string) : null;

  const tel = listing.phone?.replace(/[^\d+]/g, "");
  // Match TierBadge's Reviews verified predicate, including ownership.
  const reviewsVerified = listing.claimed && Number(listing.google_rating) > 0;
  const ownerClaimCard = !listing.claimed ? (
    <ListingOwnerClaimCard
      listingSlug={listing.slug}
      businessName={listing.name}
      reviewsVerified={reviewsVerified}
      address={[streetPublic ? lstAddr.address : null, listing.city, listing.province_state, streetPublic ? lstAddr.postal_code : null, listing.country].filter(Boolean).join(", ")}
    />
  ) : null;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LegalService",
    ...(lpOn ? { "@id": `${SITE_URL}/directory/${listing.slug}#business` } : {}),
    name: listing.name,
    description: lpKit?.description || listing.short_description || listing.description,
    telephone: listing.phone,
    email: publicEmail,
    // Conditional, NOT `url: listing.website`. JSON.stringify drops `undefined` but KEEPS `null`,
    // so an unconditional key emits `"url":null` for any row whose website is null — invalid
    // schema.org. The Arc-2 dead-website cleanup nulled 38,669 websites fleet-wide, so this is
    // now common rather than theoretical. The outbound <a> below is already guarded.
    ...(websiteHref && { url: websiteHref }),
    address: {
      "@type": "PostalAddress",
      // streetAddress/postalCode are emitted ONLY behind the owner's opt-in. A hidden
      // address must never reach the structured data — that is the whole point of the gate.
      ...(streetPublic && lstAddr.address ? { streetAddress: lstAddr.address } : {}),
      ...(streetPublic && lstAddr.postal_code ? { postalCode: lstAddr.postal_code } : {}),
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
    // PUBLIC BUSINESS FACTS (Phase 1 fan, 2026-09-04). Emitted ONLY when the owner filled
    // the field — an empty property is worse than an absent one, and these columns are NULL
    // on every seeded row by design (no backfill).
    //
    // schema.org's range for `numberOfEmployees` is QuantitativeValue, NOT a bare number,
    // so the integer is wrapped. A raw int validates as a type mismatch.
    ...(napFacts.employee_count
      ? { numberOfEmployees: { "@type": "QuantitativeValue", value: napFacts.employee_count } }
      : {}),
    // `paymentAccepted` IS Text in schema.org ("Cash, Credit Card, ...") — a free-text
    // list, not an enum. Stored already trimmed and newline-collapsed by the save path.
    ...(napFacts.payment_methods && napFacts.payment_methods.trim()
      ? { paymentAccepted: napFacts.payment_methods.trim() }
      : {}),
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

  // leads-plus-canary-v1: Service nodes (provider → this business) + FAQPage ONLY for the
  // owner-approved FAQs. On a Leads Plus page the generic vertical FAQPage below is not emitted.
  const lpServiceNames: string[] = lpOn ? (lpKit?.services ?? services) : [];
  const lpAreas: string[] = lpKit?.service_areas ?? serviceArea;
  const lpServiceLd = lpServiceNames.length
    ? lpServiceNames.slice(0, 20).map((name) => ({
        "@context": "https://schema.org",
        "@type": "Service",
        serviceType: name,
        name,
        provider: { "@id": `${SITE_URL}/directory/${listing.slug}#business` },
        ...(lpAreas.length > 0 && { areaServed: lpAreas.map((c) => ({ "@type": "City", name: c })) }),
      }))
    : null;
  const lpFaqLd = lpKit?.faqs?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: lpKit.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }
    : null;

  return (
    <>
      {lpServiceLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(lpServiceLd) }} />
      )}
      {lpFaqLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(lpFaqLd) }} />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {/* proof-of-life-stats-email-v1 (connectors-pilot-v1 port): views + phone/website clicks, claimed listings only */}
      {listing.claimed && <ListingStatsBeacon listingSlug={listing.slug} website={websiteHref} />}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-6">
          <LegalDisclaimer />
        </div>
        <Link href="/directory" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
          &larr; Back to directory
        </Link>


        {/* leads-plus-canary-v1: mobile CTA above the fold (desktop gets the sidebar block). */}
        {lpOn && (
          <div className="md:hidden mb-5" data-testid="leads-plus-mobile-cta">
            <LeadsPlusButtons slug={listing.slug} mode={lp!.mode} phone={listing.phone ?? null}
              email={lp!.publicEmail} website={lpWebsite} whatsapp={lp!.whatsapp} variant="hero" />
          </div>
        )}

        <div className={`grid grid-cols-1 gap-8 ${listing.claimed ? "md:grid-cols-3" : "lg:grid-cols-3"}`}>
          {/* Main content */}
          <div className={listing.claimed ? "md:col-span-2" : "lg:col-span-2"}>
            {can(tier, 'featured') && (
              <div className="mb-3 inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm" aria-label="Featured listing">
                <span aria-hidden="true">★</span>
                <span>FEATURED</span>
              </div>
            )}
            <div className="flex flex-wrap items-start gap-3 mb-3">
              <div className="flex items-center gap-3">
                {logoUrl && <ListingImage src={logoUrl} alt="" className="w-14 h-14 rounded-lg object-cover border" />}
                <div>
                  <h1 className="text-3xl font-bold">{listing.name}</h1>
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
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              {(listing.city || listing.province_state) && (
                <p>{[listing.city, listing.province_state].filter(Boolean).join(", ")}</p>
              )}
              {Number(listing.google_rating) > 0 && Number(listing.google_review_count) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-gray-800">
                  <span aria-hidden="true" className="text-amber-600">★</span>
                  <span>{Number(listing.google_rating).toFixed(1)} ({listing.google_review_count} reviews)</span>
                </span>
              )}
            </div>
            {ownerClaimCard && <div className="mb-6 lg:hidden">{ownerClaimCard}</div>}

            {listing.now_hiring && (
              <p className="text-sm text-green-700 mb-3">This business is currently hiring. Contact them directly to inquire about opportunities.</p>
            )}
            {/* Street and postal code retain the existing address permission gate. */}
            {streetPublic && lstAddr.address && (
              <address className="not-italic text-gray-500 mb-4">
                <span className="block">{lstAddr.address}</span>
                {lstAddr.postal_code && <span className="block">{lstAddr.postal_code}</span>}
              </address>
            )}
            {lst.year_established && (
              <p className="text-xs text-gray-500 mt-1">Established {lst.year_established}</p>
            )}
            {/* PUBLIC BUSINESS FACTS (Phase 1 fan, 2026-09-04). One line per fact, each
                rendered ONLY when its value is present, so an unfilled field emits no label
                and no empty element. The same values feed foundingDate / numberOfEmployees /
                paymentAccepted in the JSON-LD above — the page and the structured data are
                read off one row and cannot disagree. */}
            {napFacts.employee_count != null && (
              <p className="text-xs text-gray-500 mt-1">
                {napFacts.employee_count} {napFacts.employee_count === 1 ? "employee" : "employees"}
              </p>
            )}
            {napFacts.payment_methods && napFacts.payment_methods.trim() && (
              <p className="text-xs text-gray-500 mt-1">Payment methods: {napFacts.payment_methods.trim()}</p>
            )}

            {heroImageUrl && (
              <ListingImage
                src={heroImageUrl}
                alt={listing.name}
                wrapperClassName="my-6 rounded-xl overflow-hidden bg-gray-100 max-h-[420px] sm:max-h-none [container-type:inline-size]"
                className="w-full h-auto object-cover sm:max-h-[max(420px,56.25cqw)]"
              />
            )}

            <div className="prose max-w-none">
              {/* DESCRIPTION LINE BREAKS (Phase 1 fan, 2026-09-04). `white-space: pre-line` surfaces
                  the newlines an owner ALREADY types into the edit form's textarea — the save path
                  stores them verbatim (no trim, no collapse, no sanitiser on any of the four fleet
                  route shapes), and HTML's whitespace rules were collapsing them into one paragraph
                  on the way out. CSS ONLY: no dangerouslySetInnerHTML, no markdown, no HTML from
                  user input. */}
              <p className="whitespace-pre-line">{lpKit?.description || listing.description}</p>
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
            {hours && hourDays.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Hours</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm max-w-sm">
                  {hourDays.map((day) => (
                    <div key={day} className="contents">
                      <dt className="text-gray-500">{DAY_LABELS[day]}</dt>
                      <dd className="text-gray-800">{formatHoursLine(hours[day]!)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {lpKit && <LeadsPlusContent kit={lpKit} />}

            {/* Additional Information — supplementary AI enrichment (distinct, attributed block) */}
            {enrichment && (
              <EnrichmentBlock
                enrichment={enrichment}
                listingHasDescription={Boolean(listing.short_description || listing.description)}
                listingDescription={(listing.short_description || listing.description) ?? null}
                listingHasServices={services.length > 0}
                listingHasServiceArea={serviceArea.length > 0}
              />
            )}

            <ListingGallery
              photos={galleryPhotos.map(({ id, public_url }) => ({ id, public_url }))}
              businessName={listing.name}
              showHeading
            />
            {/* Contact info */}
            <div className="mt-8 border-t pt-6 space-y-2">
              <h3 className="font-semibold mb-3">Contact Information</h3>
              {listing.phone && <p className="text-sm"><span className="text-gray-500">Phone:</span> {listing.phone}</p>}
              {publicEmail && <p className="text-sm"><span className="text-gray-500">Email:</span> {publicEmail}</p>}
              <div className="flex flex-wrap items-center gap-3">
                {tel && (
                  <a href={`tel:${tel}`} className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: verticalConfig.primaryColor }}>
                    Call {listing.phone}
                  </a>
                )}
                {websiteHref && (
                  <p className="text-sm">
                    <span className="text-gray-500">Website:</span>{" "}
                    <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: verticalConfig.primaryColor }}>
                      {listing.website}
                    </a>
                  </p>
                )}
              </div>

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

            {/* Claimed listings retain the owner's Edit My Listing affordance. */}
            {listing.claimed && (
              <ListingClaimCTA listingSlug={listing.slug} listingClaimed={listing.claimed} />
            )}
          </div>

          {/* Sidebar */}
          <div className={listing.claimed ? "md:col-span-1 space-y-6" : "hidden lg:block lg:col-span-1"}>
            {ownerClaimCard && <div className="sticky top-24">{ownerClaimCard}</div>}
            {/* NO FREE LEADS (leads-plus-canary-v1 addendum A): the legacy free InquiryForm is gone. Only a Leads
               Plus listing (gate above) gets an inquiry form; everyone else gets the claim/edit CTA. */}
            {lpOn && (
              <div className="border rounded-lg p-6 sticky top-4">
                <div className="space-y-4" id="get-a-quote" data-testid="leads-plus-sidebar">
                  <div className="hidden md:block">
                    <LeadsPlusButtons slug={listing.slug} mode={lp!.mode} phone={listing.phone ?? null}
                      email={lp!.publicEmail} website={lpWebsite} whatsapp={lp!.whatsapp} variant="sidebar" />
                  </div>
                  <LeadsPlusForm listingSlug={listing.slug} businessName={listing.name} services={lp!.services} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* FAQ — visible accordion + FAQPage ld+json (sibling block; LegalService +
          BreadcrumbList above untouched). Legal disclaimer above accordion. */}
      <FaqSection
        faqs={localizeFaqs(verticalConfig.faqs, listing.city)}
        disclaimer={LEGAL_DISCLAIMER}
      />
      <p className="max-w-6xl mx-auto px-4 pb-8 text-xs text-gray-400">
        We don&apos;t vet or endorse listed businesses.
      </p>
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
