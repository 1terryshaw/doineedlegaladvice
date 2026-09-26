// owner-next-step-card-canary-v1: the ONE next action shown at the top of the owner dashboard.
// READ-ONLY derivation from columns the dashboard already loads — no writes, no new columns,
// no Google call. First matching rule wins.

export const GUIDE_PATHS = {
  gbp: "/guides/google-business-profile",
  reviews: "/guides/reviews",
  checkup: "/guides/monthly-checkup",
} as const;

// Editor anchors (components/OwnerEditForm.tsx). Order = the order the card asks for them.
export const EDITOR_ANCHORS = {
  phone: "owner-phone",
  website: "owner-website",
  hours: "owner-hours",
  description: "owner-description",
  address: "owner-street",
  photos: "owner-photos",
} as const;

// Same threshold the listing health score already uses ("5 or more Google reviews").
export const REVIEWS_ENOUGH = 5;

export type NextStepKind = "complete_field" | "add_photo" | "connect_google" | "get_reviews" | "all_set";

export interface NextStep {
  kind: NextStepKind;
  title: string;
  body: string;
  cta: { label: string; href: string };
  guide?: { label: string; href: string };
}

export interface NextStepInput {
  slug: string;
  phone?: string | null;
  website?: string | null;
  hours_json?: unknown;
  description?: string | null;
  address?: string | null;
  show_address?: boolean | null;
  google_place_id?: string | null;
  google_review_count?: number | null;
}

function blank(v: unknown): boolean {
  return typeof v !== "string" || v.trim() === "";
}

function hoursEmpty(h: unknown): boolean {
  if (!h || typeof h !== "object") return true;
  return Object.values(h as Record<string, unknown>).every((d) => d == null);
}

const FIELD_LABELS: Record<keyof typeof EDITOR_ANCHORS, string> = {
  phone: "phone number",
  website: "website",
  hours: "business hours",
  description: "business description",
  address: "street address",
  photos: "photos",
};

export function deriveNextStep(
  listing: NextStepInput,
  photoCount: number,
  opts: { addressEditable: boolean; photosSupported: boolean; reviewKit?: boolean },
): NextStep {
  const editor = `/owner/${listing.slug}/edit`;

  // 1. Core fields. Street address only where this owner can actually set it (the editor's
  //    source-class gate) and hasn't chosen to hide it.
  const missing: Array<keyof typeof EDITOR_ANCHORS> = [];
  if (blank(listing.phone)) missing.push("phone");
  if (blank(listing.website)) missing.push("website");
  if (hoursEmpty(listing.hours_json)) missing.push("hours");
  if (blank(listing.description)) missing.push("description");
  if (opts.addressEditable && listing.show_address !== false && blank(listing.address)) missing.push("address");
  if (missing.length > 0) {
    const field = missing[0];
    return {
      kind: "complete_field",
      title: `Complete your listing: add your ${FIELD_LABELS[field]}`,
      body: "Customers decide in seconds. A complete listing gets more calls.",
      cta: { label: `Add your ${FIELD_LABELS[field]}`, href: `${editor}#${EDITOR_ANCHORS[field]}` },
    };
  }

  // 2. Photos.
  if (opts.photosSupported && photoCount === 0) {
    return {
      kind: "add_photo",
      title: "Add a photo of your business",
      body: "Real photos of your work, team or storefront make your listing stand out.",
      cta: { label: "Add a photo", href: `${editor}#${EDITOR_ANCHORS.photos}` },
    };
  }

  // 3. Google — "connected" is exactly the state the dashboard's Connect card shows.
  if (blank(listing.google_place_id)) {
    return {
      kind: "connect_google",
      // owner-journey-friction-fix-v1: distinct from the dashboard section's own heading; the CTA scrolls to it.
      title: "Your next step: connect Google",
      body: "Link your Google profile so customers can see your rating on your listing.",
      cta: { label: "Connect Google", href: `/owner/${listing.slug}#google-gbp-heading` },
      guide: { label: "How to connect, step by step", href: GUIDE_PATHS.gbp },
    };
  }

  // 4. Connected, still building reviews. When the dashboard shows the review kit (see
  //    lib/review-kit.ts), the one action is the kit itself; the guide stays one tap away.
  if ((listing.google_review_count ?? 0) < REVIEWS_ENOUGH) {
    return {
      kind: "get_reviews",
      title: "Get more reviews the right way",
      body: "A steady trickle of honest reviews helps you get chosen.",
      ...(opts.reviewKit
        ? {
            cta: { label: "Get your review link and QR code", href: `/owner/${listing.slug}#review-kit` },
            guide: { label: "How to get more reviews", href: GUIDE_PATHS.reviews },
          }
        : { cta: { label: "How to get more reviews", href: GUIDE_PATHS.reviews } }),
    };
  }

  // 5. All done.
  return {
    kind: "all_set",
    title: "You're all set — here's your monthly check-up",
    body: "Ten minutes a month keeps your listing fresh.",
    cta: { label: "Open the monthly check-up", href: GUIDE_PATHS.checkup },
  };
}
