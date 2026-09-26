import { encode, renderSVG } from "uqr";

// owner-canary-fixes-and-review-kit-v1: the owner's personal Google review link + QR code.
// Pure and local — the QR is generated in-process by `uqr` (MIT, zero deps). No QR service,
// no Google API call: the link is a plain web URL the owner's customers open.

// The kit needs a ChIJ place id. A feature-id (`0x…:0x…`, what Share → Copy link yields) is
// "connected" but review-inert: every reviews path gates on ChIJ, and the writereview deep
// link does not open a review form for it (lib/gbp-chij-resolve.ts). Handing an owner a QR
// code to print for a link that can't take a review is worse than no kit.
export function reviewKitPlaceId(googlePlaceId: string | null | undefined): string | null {
  const pid = typeof googlePlaceId === "string" ? googlePlaceId.trim() : "";
  return /^ChIJ[A-Za-z0-9_-]+$/.test(pid) ? pid : null;
}

export function writeReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

const QR_BORDER = 4; // the quiet zone the QR spec requires

export interface ReviewKitData {
  url: string;
  svg: string;
  // One "0"/"1" string per row, border included, for client-side PNG rasterising.
  rows: string[];
}

export function buildReviewKit(placeId: string): ReviewKitData {
  const url = writeReviewUrl(placeId);
  const svg = renderSVG(url, { ecc: "M", border: QR_BORDER, pixelSize: 10 });
  const { data } = encode(url, { ecc: "M", border: QR_BORDER });
  return { url, svg, rows: data.map((r) => r.map((on) => (on ? "1" : "0")).join("")) };
}
