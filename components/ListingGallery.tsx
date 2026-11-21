"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listingPhotoUrl } from "@/lib/listing-photo-url";

interface Props {
  photos: { id: string; public_url: string }[];
  businessName?: string;
  showHeading?: boolean;
}

export default function ListingGallery({ photos, businessName, showHeading = false }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const galleryRef = useRef<HTMLDivElement>(null);
  // This also runs during SSR: unresolved references must never become img sources.
  const visible = photos
    .map((photo) => ({ ...photo, public_url: listingPhotoUrl(photo.public_url) || "" }))
    .filter((photo) => Boolean(photo.public_url) && !failed.has(photo.public_url));

  const removePhoto = useCallback((url: string) => {
    setFailed((previous) => new Set(previous).add(url));
    setExpanded((previous) => previous === url ? null : previous);
  }, []);

  useEffect(() => {
    // An SSR image can fail before React attaches its onError handler.
    galleryRef.current?.querySelectorAll("img").forEach((img) => {
      if (img.complete && img.naturalWidth === 0) removePhoto(img.getAttribute("src")!);
    });
  }, [photos, removePhoto]);

  // Remove the whole section, including its spacing, if every image is missing or fails.
  if (visible.length === 0) return null;

  return (
    <section className={showHeading ? "mt-8 border-t pt-6" : undefined}>
      {showHeading && <h3 className="font-semibold mb-3">Photos</h3>}
      <div ref={galleryRef} className="grid grid-cols-3 gap-2">
        {visible.map((p, index) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setExpanded(p.public_url)}
            aria-label={`${businessName || "Listing"} photo ${index + 1}`}
            className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden border hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            { /* eslint-disable-next-line @next/next/no-img-element */ }
            <img src={p.public_url} alt={businessName ? `${businessName} photo ${index + 1}` : ""} onError={() => removePhoto(p.public_url)} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      {expanded && visible.some((photo) => photo.public_url === expanded) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${businessName || "Listing"} photo`}
          onClick={() => setExpanded(null)}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-zoom-out"
        >
          { /* eslint-disable-next-line @next/next/no-img-element */ }
          <img src={expanded} alt={businessName || ""} onError={() => removePhoto(expanded)} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </section>
  );
}
