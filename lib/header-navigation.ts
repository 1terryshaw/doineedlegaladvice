export type OwnerDisplayState =
  | { authenticated: false }
  | {
      authenticated: true;
      listingCount: number;
      primaryListingSlug?: string;
    };

const LOGGED_OUT: OwnerDisplayState = { authenticated: false };

// Treat malformed or over-broad responses as display uncertainty. This parser
// cannot grant access; the public fallback is the complete logged-out header.
export function ownerDisplayStateFromPayload(data: unknown): OwnerDisplayState {
  if (!data || typeof data !== "object" || (data as { authenticated?: unknown }).authenticated !== true) {
    return LOGGED_OUT;
  }

  const response = data as { listingCount?: unknown; primaryListingSlug?: unknown };
  if (!Number.isInteger(response.listingCount) || (response.listingCount as number) < 0) {
    return LOGGED_OUT;
  }

  const listingCount = response.listingCount as number;
  if (listingCount === 1) {
    return typeof response.primaryListingSlug === "string" && response.primaryListingSlug.length > 0
      ? { authenticated: true, listingCount, primaryListingSlug: response.primaryListingSlug }
      : LOGGED_OUT;
  }

  return response.primaryListingSlug === undefined
    ? { authenticated: true, listingCount }
    : LOGGED_OUT;
}

export type HeaderNavigationItem = {
  href: string;
  label: string;
  primary?: boolean;
  active?: boolean;
};

export type HeaderNavigationState = {
  items: HeaderNavigationItem[];
  showLogout: boolean;
};

const coreItems: HeaderNavigationItem[] = [
  { href: "/directory", label: "Directory" },
];

const findProfessional: HeaderNavigationItem = {
  href: "https://doineedapro.com",
  label: "Find a Professional",
};

function isPath(pathname: string, route: string, includeDescendants = false): boolean {
  return pathname === route || (includeDescendants && pathname.startsWith(`${route}/`));
}

// Active-route precedence is intentionally exact for overlapping owner routes:
// /owner/login precedes /owner, a single dashboard is exact, and /owner is only
// the multi-listing selector. Claim descendants share the state-appropriate CTA.
export function isHeaderNavigationActive(item: HeaderNavigationItem, pathname: string): boolean {
  if (item.href === "/directory") return isPath(pathname, "/directory");
  if (item.href === "/directories") return isPath(pathname, "/directories");
  if (item.href === "/learn") return isPath(pathname, "/learn", true);
  if (item.href === "/owner/login") return isPath(pathname, "/owner/login");
  if (item.href === "/claim" || item.href.startsWith("/claim?")) return isPath(pathname, "/claim", true);
  if (item.href === "/owner") return isPath(pathname, "/owner");
  if (item.href.startsWith("/owner/")) return isPath(pathname, item.href);
  return false;
}

function withActiveState(items: HeaderNavigationItem[], pathname: string): HeaderNavigationItem[] {
  return items.map((item) => ({ ...item, active: isHeaderNavigationActive(item, pathname) }));
}

// Navigation is display-only. The listing count and optional single slug are
// produced from rows bound to the authenticated bearer token. The server still
// authorizes every owner route independently.
export function headerNavigation(
  ownerDisplay: OwnerDisplayState,
  pathname = "",
): HeaderNavigationState {
  if (!ownerDisplay.authenticated) {
    return {
      items: withActiveState([
        ...coreItems,
        { href: "/owner/login", label: "Owner Login" },
        { href: "/claim?src=header_cta", label: "Claim or Add Your Business", primary: true },
        findProfessional,
      ], pathname),
      showLogout: false,
    };
  }

  if (ownerDisplay.listingCount === 0) {
    return {
      items: withActiveState([...coreItems, { href: "/claim?src=header_cta", label: "Claim or Add Your Business", primary: true }, findProfessional], pathname),
      showLogout: true,
    };
  }

  const ownerItem = ownerDisplay.listingCount === 1 && ownerDisplay.primaryListingSlug
    ? { href: `/owner/${ownerDisplay.primaryListingSlug}`, label: "My Listing" }
    : { href: "/owner", label: "My Listings" };
  return {
    items: withActiveState([...coreItems, ownerItem, { href: "/claim?src=dashboard_claim_another", label: "Claim Another or Add a Business" }, findProfessional], pathname),
    showLogout: true,
  };
}
