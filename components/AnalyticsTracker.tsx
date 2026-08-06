"use client";

// TDL #1019 (Wave 3) — THE NUMERATOR.
//
// analytics.v_match_rate is session-level:
//   denominator = distinct sessions with ANY event on a surface
//   numerator   = distinct sessions with listing_clicked / listing_selected
//
// The directory — the surface where listings are ACTUALLY clicked — had no emitter at all, so it
// contributed to neither side. Only server routes (chat, calculator) ever logged, which is why
// 12h of production traffic produced 0 events.
//
// WHY EVENT DELEGATION, not an onClick on ListingCard:
// ListingCard is a SERVER component rendered by 6 page types (home, directory, [region],
// [region]/[city], uk/[county], uk/[county]/[town]) and prerendered as SSG. Making it a client
// component to attach a handler would drag it and its Listing type into the client bundle of every
// prerendered page. One document-level capture listener catches every <a href="/directory/{slug}">
// no matter which component emitted it — today's cards, quiz result links, and anything added later.
//
// FAIL-OPEN, per the Wave 3 design rules: analytics must never break or block the page.

import { useEffect } from "react";

const SID_KEY = "empire_sid";
const STARTED_KEY = "empire_dir_started";

function sessionId(): string | null {
  try {
    let s = sessionStorage.getItem(SID_KEY);
    if (!s) {
      s =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(SID_KEY, s);
    }
    return s;
  } catch {
    return null; // private mode / storage blocked → drop the event rather than break anything
  }
}

/** Exported so client surfaces (the quiz widget) emit through the SAME session id and transport. */
export function emitEvent(body: Record<string, unknown>) {
  emit(body);
}

function emit(body: Record<string, unknown>) {
  try {
    const sid = sessionId();
    if (!sid) return;
    const payload = JSON.stringify({ session_id: sid, ...body });
    // sendBeacon survives the navigation a listing click triggers; a plain fetch() is frequently
    // cancelled mid-flight when the page unloads, which would lose exactly the event we care about.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/event", new Blob([payload], { type: "application/json" }));
    } else {
      void fetch("/api/event", {
        method: "POST",
        body: payload,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* FAIL-OPEN */
  }
}

export default function AnalyticsTracker() {
  useEffect(() => {
    // One `started` per session — this is the match-rate DENOMINATOR for the directory surface.
    try {
      if (!sessionStorage.getItem(STARTED_KEY)) {
        sessionStorage.setItem(STARTED_KEY, "1");
        emit({ surface: "directory", event_type: "started" });
      }
    } catch {
      /* ignore */
    }

    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      const a = el?.closest?.("a[href*='/directory']") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") || "";

      // Attribute the click to whichever surface owns the subtree it happened in. The quiz widget
      // marks its root with data-analytics-surface="quiz", so its CTA is credited to the quiz —
      // not to the directory it happens to point at. Anything unmarked is the directory itself.
      const owner = a.closest("[data-analytics-surface]") as HTMLElement | null;
      const surface = owner?.getAttribute("data-analytics-surface") || "directory";

      // A real listing: /directory/{slug}
      const m = href.match(/\/directory\/([^/?#]+)/);
      if (m) {
        emit({
          surface,
          event_type: "listing_clicked",
          listing_slug: decodeURIComponent(m[1]),
          outbound_url: href,
        });
        return;
      }

      // A filtered directory index: /directory?listing_type=…&region=…
      // From the quiz this IS the conversion — the user accepted the recommendation and went to the
      // matched cohort. On the directory surface itself the same href is just a filter/pagination
      // click, so it must NOT count as a match. outbound_url records exactly what was clicked, so
      // this stays reinterpretable if the label is ever revised.
      if (surface !== "directory" && /\/directory\?/.test(href)) {
        emit({ surface, event_type: "listing_selected", outbound_url: href });
      }
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
