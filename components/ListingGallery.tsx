"use client";

import { useState } from "react";

interface Props {
  photos: { id: string; public_url: string }[];
}

export default function ListingGallery({ photos }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (photos.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-3 gap-2 mt-6">
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setExpanded(p.public_url)}
            className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden border hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            { /* eslint-disable-next-line @next/next/no-img-element */ }
            <img src={p.public_url} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setExpanded(null)}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-zoom-out"
        >
          { /* eslint-disable-next-line @next/next/no-img-element */ }
          <img src={expanded} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  );
}
