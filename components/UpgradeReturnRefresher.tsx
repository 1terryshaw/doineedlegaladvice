"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// When the owner returns from Stripe with ?upgrade=success or ?upgrade=swap,
// refresh server data ONCE so the dashboard reflects the new tier.
export default function UpgradeReturnRefresher() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refreshed = useRef(false);

  useEffect(() => {
    if (refreshed.current) return;
    const upgradeFlag = searchParams?.get("upgrade");
    if (upgradeFlag === "success" || upgradeFlag === "swap") {
      refreshed.current = true;
      // Small delay to let webhook DB write land (it's typically <1s but webhook is async)
      const t = setTimeout(() => {
        router.refresh();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [searchParams, router]);

  return null;
}
