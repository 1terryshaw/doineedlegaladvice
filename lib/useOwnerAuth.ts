"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { ownerDisplayStateFromPayload, type OwnerDisplayState } from "@/lib/header-navigation";

type OwnerAuth = {
  authenticated: boolean;
  listingCount: number;
  primaryListingSlug?: string;
  slug: string | null;
  tier: string | null;
  loading: boolean;
  refresh: () => void;
};

const LOGGED_OUT: OwnerDisplayState = { authenticated: false };

export type OwnerContextState =
  | { authenticated: false }
  | { authenticated: true; slug: string; tier: string | null };

const LOGGED_OUT_CONTEXT: OwnerContextState = { authenticated: false };

export function ownerContextStateFromPayload(data: unknown): OwnerContextState {
  if (!data || typeof data !== "object" || (data as { authenticated?: unknown }).authenticated !== true) {
    return LOGGED_OUT_CONTEXT;
  }

  const response = data as { slug?: unknown; tier?: unknown };
  if (typeof response.slug !== "string" || response.slug.length === 0) {
    return LOGGED_OUT_CONTEXT;
  }

  return typeof response.tier === "string" || response.tier === null
    ? { authenticated: true, slug: response.slug, tier: response.tier }
    : LOGGED_OUT_CONTEXT;
}

type OwnerAuthOptions = {
  context?: boolean;
  listingSlug?: string;
};

export function useOwnerAuth({ context = false, listingSlug }: OwnerAuthOptions = {}): OwnerAuth {
  const pathname = usePathname();
  const [refreshKey, setRefreshKey] = useState(0);
  // Static HTML starts with a complete logged-out header. A failed display
  // probe stays usable and never affects public route rendering.
  const [displayState, setDisplayState] = useState<OwnerDisplayState>(LOGGED_OUT);
  const [contextState, setContextState] = useState<OwnerContextState>(LOGGED_OUT_CONTEXT);
  const [contextLoading, setContextLoading] = useState(context);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    fetch("/api/owner/me", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("Owner display request failed")))
      .then((data) => setDisplayState(ownerDisplayStateFromPayload(data)))
      .catch(() => {
        // A display probe is never authorization. If it cannot be verified,
        // fall back to the same usable logged-out navigation as static HTML.
        setDisplayState(LOGGED_OUT);
      });
  }, [pathname, refreshKey]);

  useEffect(() => {
    if (!context) {
      setContextState(LOGGED_OUT_CONTEXT);
      setContextLoading(false);
      return;
    }

    setContextLoading(true);
    const query = listingSlug ? `?listingSlug=${encodeURIComponent(listingSlug)}` : "";
    fetch(`/api/owner/context${query}`, { cache: "no-store" })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("Owner context request failed")))
      .then((data) => setContextState(ownerContextStateFromPayload(data)))
      .catch(() => setContextState(LOGGED_OUT_CONTEXT))
      .finally(() => setContextLoading(false));
  }, [context, listingSlug, pathname, refreshKey]);

  return {
    authenticated: context ? contextState.authenticated : displayState.authenticated,
    listingCount: displayState.authenticated ? displayState.listingCount : 0,
    primaryListingSlug: displayState.authenticated ? displayState.primaryListingSlug : undefined,
    slug: contextState.authenticated ? contextState.slug : null,
    tier: contextState.authenticated ? contextState.tier : null,
    loading: context ? contextLoading : false,
    refresh,
  };
}
