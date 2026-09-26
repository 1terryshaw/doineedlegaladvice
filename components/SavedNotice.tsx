"use client";

import { useEffect, useState } from "react";

// owner-journey-friction-fix-v1: after Save Changes the editor lands here with ?saved=1.
// One dismissible line above the next-step card; the flag is dropped from the URL so a
// reload doesn't repeat it. No email, no write.
export default function SavedNotice() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("saved")) return;
    url.searchParams.delete("saved");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);

  if (!open) return null;
  return (
    <div
      role="status"
      data-saved-notice
      className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
    >
      <span>Saved — your listing is updated.</span>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Dismiss"
        className="shrink-0 text-green-700 hover:text-green-900"
      >
        ×
      </button>
    </div>
  );
}
