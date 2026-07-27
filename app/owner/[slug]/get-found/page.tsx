import { redirect } from "next/navigation";
import { Metadata } from "next";
import { verifyOwnerAccess } from "@/lib/auth";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import GetFoundStep, { type PendingMatch } from "@/components/GetFoundStep";
import { buildReviewLink, resolvePlaceId } from "@/lib/review-link";

// claim-vsl-v1 Part 2 — the post-claim "Get found on Google" step.
//
// Reached automatically on the first owner-dashboard visit after a claim (see
// app/owner/[slug]/page.tsx), and linkable directly afterwards. Entirely
// ADDITIVE: nothing in /api/claim or /api/claim/verify was touched to build it.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Get found on Google",
  robots: { index: false, follow: false },
};

export default async function GetFoundPage({ params }: Props) {
  const { slug } = await params;
  const result = await verifyOwnerAccess(slug);
  if (!result) redirect("/owner/login");

  const listing = result.listing as {
    id?: string;
    business_name?: string | null;
    name?: string | null;
    owner_name?: string | null;
    gbp_url?: string | null;
    gbp_place_id?: string | null;
    google_place_id?: string | null;
  };

  // Two-tier display: surface a machine-resolved, UNCONFIRMED Google match (if any) for
  // owner approval. Only when the listing has no PUBLIC place_id yet (a confirmed/rendering
  // listing has no pending row). Nothing here writes; the owner acts via /api/owner/confirm-place-id.
  let pendingMatch: PendingMatch | null = null;
  if (listing.id && !listing.google_place_id) {
    const { data: pend } = await supabaseAdmin
      .from("listing_place_id_pending")
      .select("pending_place_id, pending_rating, pending_review_count, pending_name, confirmed")
      .eq("source_table", LISTINGS_TABLE)
      .eq("listing_id", listing.id)
      .maybeSingle();
    if (pend && pend.confirmed === false && pend.pending_place_id && pend.pending_rating != null && pend.pending_review_count) {
      pendingMatch = {
        placeId: pend.pending_place_id as string,
        rating: Number(pend.pending_rating),
        count: Number(pend.pending_review_count),
        name: (pend.pending_name as string) ?? null,
      };
    }
  }

  // B3 — the "write a review" deep link. Built by STRING CONCATENATION from an
  // id we already store; no Google API is called. Null unless we hold a
  // ChIJ-format Place ID, because that is the only form the writereview
  // endpoint resolves — a hex feature id or a cid-only save falls back to the
  // dashboard instructions rather than rendering a link that 404s.
  const reviewLink = buildReviewLink(resolvePlaceId(listing.gbp_place_id, listing.gbp_url));

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <GetFoundStep
        slug={slug}
        businessName={(listing.business_name || listing.name || "your business").trim()}
        ownerName={(listing.owner_name || "").trim()}
        existingGbpUrl={listing.gbp_url || ""}
        reviewLink={reviewLink}
        pendingMatch={pendingMatch}
      />
    </div>
  );
}
