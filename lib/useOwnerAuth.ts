"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

interface OwnerAuth {
  authenticated: boolean;
  slug: string | null;
  ownerEmail: string | null;
  tier: string | null;
  loading: boolean;
  refresh: () => void;
}

export function useOwnerAuth(): OwnerAuth {
  const pathname = usePathname();
  const [refreshKey, setRefreshKey] = useState(0);
  const [auth, setAuth] = useState<OwnerAuth>({
    authenticated: false,
    slug: null,
    ownerEmail: null,
    tier: null,
    loading: true,
    refresh: () => {},
  });

  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    setAuth((prev) => ({ ...prev, loading: true }));
    fetch("/api/owner/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setAuth({
          authenticated: data.authenticated,
          slug: data.slug || null,
          ownerEmail: data.ownerEmail || null,
          tier: data.tier || null,
          loading: false,
          refresh,
        });
      })
      .catch(() => {
        setAuth((prev) => ({ ...prev, loading: false }));
      });
  }, [pathname, refreshKey]);

  return { ...auth, refresh };
}
