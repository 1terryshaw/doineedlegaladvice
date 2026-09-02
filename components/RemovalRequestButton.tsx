"use client";

import { useState } from "react";

// Reusable compliance widget (empire-wide, stampable — no trade name in any string).
// Submits a human-reviewed removal REQUEST; it does not instantly remove the listing.
export default function RemovalRequestButton({
  listingSlug,
  listingId,
}: {
  listingSlug: string;
  listingId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/removal-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requester_email: email,
          reason,
          listing_slug: listingSlug,
          listing_id: listingId ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not submit your request.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setError("Could not submit your request. Please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="text-sm text-gray-600">
        Thank you. Your removal request has been received and will be reviewed.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-gray-600 underline"
      >
        Request removal of this listing
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-3 border rounded-lg p-4 bg-gray-50">
      <p className="text-xs text-gray-600">
        Request removal of this listing. Requests are reviewed by a person before any
        action is taken.
      </p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
        className="w-full border rounded-md px-3 py-2 text-sm"
      />
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        rows={3}
        className="w-full border rounded-md px-3 py-2 text-sm"
      />
      {state === "error" && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={state === "sending"}
          className="text-sm bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-900 disabled:opacity-50"
        >
          {state === "sending" ? "Submitting…" : "Submit request"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
