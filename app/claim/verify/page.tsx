// CLAIM-VERIFY INTERSTITIAL — the confirmation step between the mailed link and the write.
//
// WHY THIS PAGE EXISTS (recon-v1 §D step 4 · ruling R2 · fan 2026-09-11)
// ---------------------------------------------------------------------
// The link we mail an owner used to be a bare GET on /api/claim/verify, and that GET was
// the WRITER: first fetch set claimed=true, claimed_at, and (where this repo carries the
// #1068 republish guard) flipped is_published false→true. Anything that fetches URLs out of
// inbound mail therefore completed the claim on the recipient's behalf, silently: corporate
// link-safety rewriters (Proofpoint, Mimecast, Defender ATP), spam scanners and inbox link
// previewers all do exactly that. Afterwards the row is indistinguishable from a genuine
// claim — same columns, same timestamps — so the damage is not even detectable.
//
// A scanner will happily fetch THIS page too. That is fine and is the whole point: this page
// does not write. It reads the row to check the token and to show the owner which listing
// they are about to claim, and the write happens only on a POST a human has to click.
//
// WHAT IS AND IS NOT VALIDATED HERE
// ---------------------------------
// Token + expiry are checked here so the page can name the listing WITHOUT leaking it: a
// wrong or missing token renders nothing and redirects to /claim/error. That check is NOT
// the security boundary — POST /api/claim/verify re-validates token, expiry and row from
// scratch and refuses on its own. This one exists so an owner with a dead link is told so
// before clicking instead of after.
//
// The column list below is THIS repo's own vocabulary, taken from what its verify route
// already selects in production. A select naming a column this table does not have returns
// an error, which would redirect every owner to /claim/error — the fix breaking the funnel
// it was shipped to repair.
//
// The form is plain HTML posting to the API route: no client component, no JS, no fetch. It
// works with scripting disabled, and there is nothing on the page that can fire itself.

import { Metadata } from "next";
import { redirect } from "next/navigation";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "default-no-store";

export const metadata: Metadata = {
  title: "Confirm your claim",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ token?: string; slug?: string }>;
}

export default async function ClaimVerifyPage({ searchParams }: Props) {
  const { token, slug } = await searchParams;

  const errorUrl = (s?: string | null) =>
    `/claim/error${s ? `?slug=${encodeURIComponent(s)}` : ""}`;

  if (!token || !slug) redirect(errorUrl(slug));

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    // Claim-context read: deliberately NOT is_published-filtered, because the whole point is
    // that a de-served / seeded row can be claimed back (recon-v1 §A3). Only these columns —
    // never a select("*") that would drag owner_auth_token siblings into a rendered page's props.
    .select("owner_auth_token, owner_auth_token_expires_at")
    .eq("slug", slug)
    .single();

  // Same refusals as the writer, in the same order, so the page and the POST agree.
  if (error || !listing || listing.owner_auth_token !== token) redirect(errorUrl(slug));
  if (
    listing.owner_auth_token_expires_at &&
    new Date(listing.owner_auth_token_expires_at).getTime() < Date.now()
  ) {
    redirect(errorUrl(slug));
  }

  const displayName = "your listing";

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-4">Confirm your claim</h1>
      <p className="text-gray-700 mb-2">
        You are about to claim <strong>{displayName}</strong>.
      </p>
      <p className="text-gray-600 mb-8 text-sm">
        Confirming verifies your email address and gives you owner access to this listing. You
        can update it or ask for it to be removed at any time afterwards.
      </p>

      {/* The ONLY thing on this page that writes. A human has to press it. */}
      <form method="post" action="/api/claim/verify">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="slug" value={slug} />
        <button
          type="submit"
          className="w-full rounded-lg bg-slate-800 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-900 transition-colors"
        >
          Confirm my claim
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-gray-500">
        If you did not request this, you can close this page — nothing has been changed.
      </p>
    </div>
  );
}
