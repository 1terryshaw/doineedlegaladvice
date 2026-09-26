"use client";
// owner-journey-friction-fix-v1: ruling 14 (one label for /guides/reviews).

import { useState } from "react";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import type { ReviewKitData } from "@/lib/review-kit";
import { GUIDE_PATHS } from "@/lib/owner-next-step";

// owner-canary-fixes-and-review-kit-v1: shown only to a Google-connected owner (ChIJ id).
// Everything here is local: copy to clipboard, SVG download of the server-made QR, and a
// PNG rasterised in the browser from the same module grid.
const vc = verticalConfig as unknown as { primaryColor: string; ctaColor?: string };
const CTA_COLOR = vc.ctaColor || vc.primaryColor;
const PNG_MODULE_PX = 16;

function download(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function ReviewKit({ kit, slug }: { kit: ReviewKitData; slug: string }) {
  const [copied, setCopied] = useState(false);
  const svgSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(kit.svg)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(kit.url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = kit.url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadSvg() {
    download(new Blob([kit.svg], { type: "image/svg+xml" }), `review-qr-${slug}.svg`);
  }

  function downloadPng() {
    const n = kit.rows.length;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = n * PNG_MODULE_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    kit.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === "1") ctx.fillRect(x * PNG_MODULE_PX, y * PNG_MODULE_PX, PNG_MODULE_PX, PNG_MODULE_PX);
      }
    });
    canvas.toBlob((b) => b && download(b, `review-qr-${slug}.png`), "image/png");
  }

  const btn = "px-4 py-2 rounded-lg text-sm font-semibold border text-center";
  return (
    <section
      id="review-kit"
      data-review-kit-owner
      aria-labelledby="review-kit-heading"
      className="border rounded-lg p-5 sm:p-6 scroll-mt-4"
    >
      <h2 id="review-kit-heading" className="text-lg sm:text-xl font-bold">Your review kit</h2>
      <p className="text-sm text-gray-600 mt-1">
        Send this link, or show the QR code, to customers after a job. It opens Google&apos;s review form for your
        business.{" "}
        <Link href={GUIDE_PATHS.reviews} data-review-kit-guide className="font-medium underline" style={{ color: vc.primaryColor }}>
          How to get more reviews
        </Link>
      </p>

      <div className="mt-4 flex flex-col sm:flex-row gap-5 sm:items-start">
        <div className="shrink-0 self-center sm:self-start">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data: URI, not an optimisable asset */}
          <img
            src={svgSrc}
            alt="QR code that opens your Google review form"
            data-review-kit-qr
            width={176}
            height={176}
            className="w-44 h-44 border rounded"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <label htmlFor="review-kit-link" className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Your review link
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="review-kit-link"
              data-review-kit-link
              readOnly
              value={kit.url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 border rounded-lg px-3 py-2 text-sm bg-gray-50"
            />
            <button
              type="button"
              data-review-kit-copy
              onClick={copy}
              className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
              style={{ backgroundColor: CTA_COLOR }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" data-review-kit-png onClick={downloadPng} className={btn} style={{ color: vc.primaryColor }}>
              Download QR (PNG)
            </button>
            <button type="button" data-review-kit-svg onClick={downloadSvg} className={btn} style={{ color: vc.primaryColor }}>
              Download QR (SVG)
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
