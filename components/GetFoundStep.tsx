"use client";

// claim-vsl-v1 Part 2 — "Get found on Google" post-claim step.
//
// Tone rule from the buildspec: helpful, ZERO upsell on this screen. No tier
// pitch, no pricing, no second offer. Skipping is one tap and never blocks
// anything — the claim is already complete before this screen renders.
//
// ZERO Google API calls. Every Google reference here is a plain link or static
// copy; nothing is fetched from Places/Maps/GBP.

import { useState } from "react";
import { useRouter } from "next/navigation";
import verticalConfig from "@/lib/vertical.config";

// Two-tier port: cookie name mirrors the pilot's claim-vsl constant without importing
// the hvac-only claim-vsl module (which carries the video-funnel machinery).
const GET_FOUND_DISMISSED_COOKIE = `${verticalConfig.tablePrefix}getfound_done`;

const CHECKLIST = [
  {
    title: "Don't have a Google Business Profile yet?",
    body: (
      <>
        Create one free at{" "}
        <a
          href="https://www.google.com/business/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium"
        >
          google.com/business
        </a>
        . It&rsquo;s the listing that shows up in Google Maps and the local results.
      </>
    ),
  },
  {
    title: "Add at least 5 real photos",
    body: <>Trucks, jobs, the team. Profiles with photos get more calls than ones without.</>,
  },
  {
    title: "Check your hours and phone number",
    body: <>Wrong hours kill trust faster than no hours. Two minutes to verify, worth it.</>,
  },
  {
    title: "Text 3 recent happy customers for a review",
    body: <>Recent reviews matter more than old ones. Use the template below.</>,
  },
];

export type PendingMatch = { placeId: string; rating: number; count: number; name: string | null };

export default function GetFoundStep({
  slug,
  businessName,
  ownerName,
  existingGbpUrl,
  reviewLink,
  pendingMatch: initialPending,
}: {
  slug: string;
  businessName: string;
  ownerName: string;
  existingGbpUrl: string;
  /** Ready-to-send review URL, or null when we can't build a WORKING one. */
  reviewLink: string | null;
  /** Machine-resolved, UNCONFIRMED Google match awaiting owner approval (two-tier display). */
  pendingMatch?: PendingMatch | null;
}) {
  const router = useRouter();

  // Two-tier display: confirm-first approval of a pending Google match.
  const [pending, setPending] = useState<PendingMatch | null>(initialPending ?? null);
  const [pendingState, setPendingState] = useState<"idle" | "working" | "confirmed" | "rejected" | "editing" | "error">("idle");
  const [editUrl, setEditUrl] = useState("");
  const [pendingMsg, setPendingMsg] = useState("");

  async function actOnPending(action: "approve" | "reject" | "edit") {
    setPendingState("working");
    setPendingMsg("");
    try {
      const res = await fetch("/api/owner/confirm-place-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "edit" ? { action, gbpUrl: editUrl } : { action }),
      });
      const data = await res.json().catch(() => null);
      if (action === "approve" && res.ok && data?.ok) { setPendingState("confirmed"); return; }
      if (action === "reject" && res.ok && data?.ok) { setPendingState("rejected"); setPending(null); return; }
      if (action === "edit" && res.ok && data?.ok) {
        setPending({ placeId: "", rating: data.rating, count: data.count, name: data.name });
        setPendingState("idle");
        return;
      }
      setPendingMsg(data?.message || "That didn't work. Please try again.");
      setPendingState("error");
    } catch {
      setPendingMsg("Network error. Please try again.");
      setPendingState("error");
    }
  }
  const [url, setUrl] = useState(existingGbpUrl);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // When we hold a usable Place ID the template arrives ready to send; otherwise
  // it keeps the {your review link} placeholder and the instructions below tell
  // the owner where to find it. Never a half-built URL.
  const smsTemplate = `Hey {first name}, it's ${ownerName || "{your name}"} from ${businessName}. If you were happy with the work, a quick Google review would help us a ton — takes 30 seconds: ${reviewLink ?? "{your review link}"}. Thank you!`;

  function dismissAndGoToDashboard() {
    // 1 year, path=/, no Domain attribute (see Domain Rules in CLAUDE.md).
    document.cookie = `${GET_FOUND_DISMISSED_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.push(`/owner/${slug}`);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");
    try {
      const res = await fetch("/api/owner/gbp-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gbpUrl: url }),
      });
      const data: { ok?: boolean; message?: string } | null = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setStatus("saved");
        return;
      }
      setErrorMsg(data?.message || "We couldn't save that link. Please try again in a moment.");
      setStatus("error");
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  async function copyReviewLink() {
    if (!reviewLink) return;
    try {
      await navigator.clipboard.writeText(reviewLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* clipboard blocked — the field is select-all on screen */
    }
  }

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(smsTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the text is selectable on screen anyway */
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-green-700 mb-1">✓ {businessName} is claimed.</p>
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">Now let&rsquo;s get you found on Google</h1>
      <p className="text-gray-600 mb-8">
        Your listing here is sorted. This takes a couple more minutes and it&rsquo;s the single
        biggest thing you can do for local calls. It&rsquo;s free — skip it if you&rsquo;d rather.
      </p>

      {/* Two-tier display — confirm-first Google match (spec v2). Shown only when a
          machine-resolved match is pending; nothing renders publicly until Approve. */}
      {pending && pendingState !== "confirmed" && pendingState !== "rejected" && (
        <div data-testid="pending-match" className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-8">
          <h2 className="font-bold mb-1">Is this your Google listing?</h2>
          <p className="text-[15px] mb-3">
            <strong>{pending.name || businessName}</strong> — ★ {pending.rating.toFixed(1)} ({pending.count} reviews).
            Confirm it&rsquo;s yours and we&rsquo;ll show your star rating and review count on your listing.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" disabled={pendingState === "working"} onClick={() => actOnPending("approve")}
              className="px-5 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
              style={{ backgroundColor: verticalConfig.primaryColor }}>
              {pendingState === "working" ? "Saving…" : "Yes, that's us — show it"}
            </button>
            <button type="button" disabled={pendingState === "working"} onClick={() => setPendingState("editing")}
              className="px-5 py-2 rounded-lg border font-medium text-sm text-gray-600 hover:bg-gray-50">
              Not mine / wrong one
            </button>
          </div>
          {pendingState === "editing" && (
            <div className="mt-3">
              <p className="text-sm text-gray-500 mb-2">Paste your Google Maps link and we&rsquo;ll use that instead:</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input type="url" inputMode="url" value={editUrl} onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="https://maps.app.goo.gl/..."
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" disabled={!editUrl.trim()} onClick={() => actOnPending("edit")}
                  className="px-5 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                  style={{ backgroundColor: verticalConfig.primaryColor }}>Use this</button>
              </div>
            </div>
          )}
          {pendingState === "error" && <p className="text-red-600 text-sm mt-2">{pendingMsg}</p>}
        </div>
      )}
      {pendingState === "confirmed" && (
        <div data-testid="pending-confirmed" className="bg-green-50 border border-green-200 rounded-xl p-5 mb-8">
          <p className="text-green-800 font-medium">✓ Your Google rating and review count are now showing on your listing.</p>
        </div>
      )}

      {/* Optional GBP link capture */}
      <form onSubmit={handleSave} className="bg-gray-50 border rounded-xl p-5 mb-8">
        <label htmlFor="gbp-url" className="block font-semibold mb-1">
          Paste your Google Business Profile link
        </label>
        <p className="text-sm text-gray-500 mb-3">
          Optional. Open your business on Google Maps and copy the address bar. We use it to link
          the two profiles together — nothing is posted to Google.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="gbp-url"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (status !== "idle") setStatus("idle");
            }}
            placeholder="https://maps.app.goo.gl/..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={status === "saving" || !url.trim()}
            className="px-5 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
            style={{ backgroundColor: verticalConfig.primaryColor }}
          >
            {status === "saving" ? "Saving..." : "Save link"}
          </button>
        </div>
        {status === "error" && <p className="text-red-600 text-sm mt-2">{errorMsg}</p>}
        {status === "saved" && <p className="text-green-700 text-sm mt-2">Saved. Thanks!</p>}
      </form>

      {/* Static checklist — no API calls */}
      <h2 className="text-lg font-bold mb-4">Your 4-step Google checklist</h2>
      <ol className="space-y-5 mb-8">
        {CHECKLIST.map((item, i) => (
          <li key={item.title} className="flex gap-3">
            <span
              className="flex-shrink-0 w-7 h-7 rounded-full text-white text-sm font-bold flex items-center justify-center"
              style={{ backgroundColor: verticalConfig.primaryColor }}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div>
              <p className="font-semibold">{item.title}</p>
              <p className="text-gray-600 text-[15px] leading-snug">{item.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Copy-paste review request */}
      <div className="border rounded-xl p-5 mb-8">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-semibold">Copy-paste review request</h3>
          <button
            type="button"
            onClick={copyTemplate}
            className="text-sm underline flex-shrink-0"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p
          data-testid="sms-template"
          className="text-[15px] bg-gray-50 border rounded-lg p-3 whitespace-pre-wrap select-all"
        >
          {smsTemplate}
        </p>
        {reviewLink ? (
          <p className="text-sm text-gray-500 mt-3">
            Your review link is already in the message above — it came from the profile you saved.
          </p>
        ) : (
          <p className="text-sm text-gray-500 mt-3">
            Your review link is in your Google Business Profile dashboard — look for &ldquo;Ask for
            reviews&rdquo;.
          </p>
        )}
      </div>

      {/* Ready-to-send review link. Rendered ONLY when a working URL exists. */}
      {reviewLink && (
        <div className="border rounded-xl p-5 mb-8">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-semibold">Your Google review link</h3>
            <button
              type="button"
              onClick={copyReviewLink}
              data-testid="copy-review-link"
              className="text-sm underline flex-shrink-0"
            >
              {linkCopied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            Send this to a customer and it opens the review box on your profile straight away.
          </p>
          <p
            data-testid="review-link"
            className="text-[13px] break-all bg-gray-50 border rounded-lg p-3 select-all font-mono"
          >
            {reviewLink}
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={dismissAndGoToDashboard}
          className="flex-1 px-6 py-3 rounded-lg text-white font-medium"
          style={{ backgroundColor: verticalConfig.primaryColor }}
        >
          Done — go to my dashboard
        </button>
        <button
          type="button"
          onClick={dismissAndGoToDashboard}
          className="px-6 py-3 rounded-lg border font-medium text-gray-600 hover:bg-gray-50"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
