"use client";

import { Fragment, useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import verticalConfig from "@/lib/vertical.config";
import { useOwnerAuth } from "@/lib/useOwnerAuth";
import { headerNavigation, type HeaderNavigationItem } from "@/lib/header-navigation";
import { Share2 } from "lucide-react";
import ShareButtons from "@/components/pizzazz/ShareButtons";

// Wordmark is the brand shown in the bar; verticalConfig.name carries the TLD for
// metadata/share/copyright, which should keep it. Strip it for display only.
const WORDMARK = verticalConfig.name.replace(/\.(com|ca|org|net|info)$/i, "");
const HEADER_FOCUS_RING = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const HEADER_ACTIVE_LINK = "font-semibold underline decoration-2 underline-offset-4";

// This is deliberately a client display adapter. Public layout rendering never
// reads a cookie or owner record; the server-authoritative endpoint is queried
// after hydration and a failed probe remains fully logged out.
export default function Header() {
  const [showCopied, setShowCopied] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const mobileNavRef = useRef<HTMLDetailsElement>(null);
  // Native <details> mobile menu persists across client-side navigation. Close it on
  // route change so selecting a nav item collapses the dropdown (mobile hamburger).
  useEffect(() => {
    if (mobileNavRef.current) mobileNavRef.current.open = false;
  }, [pathname]);
  const ownerDisplay = useOwnerAuth();
  const navigation = headerNavigation(
    ownerDisplay.authenticated
      ? {
          authenticated: true,
          listingCount: ownerDisplay.listingCount,
          primaryListingSlug: ownerDisplay.primaryListingSlug,
        }
      : { authenticated: false },
    pathname,
  );

  const primaryItem = navigation.items.find((i) => i.primary);

  async function handleLogout() {
    await fetch("/api/owner/logout", { method: "POST" });
    ownerDisplay.refresh();
    router.push("/");
    router.refresh();
  }

  const handleMobileShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: verticalConfig.name, url }); } catch {}
      return;
    }
    try { await navigator.clipboard.writeText(url); } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  }, []);

  const renderItem = (item: HeaderNavigationItem, mobile = false) => (
    <Link
      key={item.href}
      href={item.href}
      {...(/^https?:\/\//.test(item.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={item.primary
        ? `${HEADER_FOCUS_RING} no-underline whitespace-nowrap ${mobile ? "block text-center" : ""} px-4 py-2 rounded-lg text-white font-semibold text-sm hover:opacity-90 transition-opacity ${item.active ? "ring-2 ring-gray-900 ring-offset-2" : ""}`
        : `${HEADER_FOCUS_RING} ${mobile ? "block" : "whitespace-nowrap"} text-gray-600 hover:text-gray-900 ${item.active ? HEADER_ACTIVE_LINK : ""}`}
      style={item.primary ? { backgroundColor: (verticalConfig as { accentColor?: string }).accentColor || verticalConfig.primaryColor } : undefined}
      aria-current={item.active ? "page" : undefined}
    >
      {item.label}
    </Link>
  );

  const logout = (mobile = false) => navigation.showLogout && (
    <button
      type="button"
      onClick={handleLogout}
      className={`${HEADER_FOCUS_RING} ${mobile ? "block" : "whitespace-nowrap"} text-gray-600 hover:text-gray-900`}
    >
      Log Out
    </button>
  );

  // Find a Professional is intentionally last in every state; Log Out belongs
  // immediately before it in authenticated states.
  // WS3(b) — the primary Claim CTA is rendered OUTSIDE the hamburger (see the mobile
  // cluster below) so it is visible at every width, so it is dropped from the mobile list
  // here rather than shown twice. Log Out stays immediately before the last item in both.
  // tap44b (TDL #1257 — the fleet fan of the doineedabookkeeper pilot, Site Surfer #1):
  // tap44 repaired the Claim CTA only. The other three
  // bar controls stayed under the 44px floor at 390 on all four audited paths AND on the donor:
  // brand 220×28, Share 36×36, menu summary 36×36, every one of them hit-testing true at its
  // centre. Below md they now carry padding only — brand `max-md:py-3` (20+24), Share and
  // summary `max-md:p-3` (20+24). The brand is padded rather than made `inline-flex` on purpose:
  // it is a blockified flex item carrying `truncate`, and `text-overflow:ellipsis` does not apply
  // to a flex container, so the obvious symmetry with the Claim CTA would silently kill its
  // ellipsis and turn a graceful truncation into real overflow.
  //
  // The cluster gap goes gap-1.5 -> gap-1 below sm to give the two wider icon buttons 4px back;
  // written as a base utility, not `max-md:gap-1`, because 640–767 would otherwise have both
  // `sm:gap-2` and a max- variant applying and Tailwind's group ordering would decide silently.
  // `max-md:` only, so 768px and up — which for THIS repo is still the collapsed branch, it
  // collapses at its own measured breakpoint, not at md — is untouched and 1280 is byte-identical.
  //
  // The brand's padding is the ONE value the pilot could not simply be copied on: its own brand
  // is `text-xl` (28px), but 14 forks render the brand `text-sm sm:text-xl`, i.e. 20px below
  // 640 — `py-2` would leave those at 36px, still under the floor. The padding is therefore
  // chosen from the MEASURED brand height so every fork lands on 44, not on the pilot's number.
  const renderNavigation = (mobile = false) => {
    const items = mobile ? navigation.items.filter((i) => !i.primary) : navigation.items;
    return items.map((item, index) => (
      <Fragment key={item.href}>
        {renderItem(item, mobile)}
        {navigation.showLogout && index === items.length - 2 ? logout(mobile) : null}
      </Fragment>
    ));
  };

  return (
    <header className="border-b bg-white relative z-50">
      <div className="max-w-7xl min-[1264px]:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className={`${HEADER_FOCUS_RING} min-w-0 truncate max-md:py-3 text-sm sm:text-xl font-bold min-[1264px]:shrink-0 min-[1264px]:mr-4`} style={{ color: verticalConfig.primaryColor }}>
            {WORDMARK}
          </Link>
          <nav aria-label="Primary navigation" className="hidden min-[1264px]:flex items-center gap-6">
            {renderNavigation()}
            <div className="border-l pl-4 ml-2 shrink-0"><ShareButtons variant="compact" title={verticalConfig.name} /></div>
          </nav>
          <div className="min-[1264px]:hidden flex items-center gap-1 sm:gap-2 shrink-0">
            {primaryItem && (
              <Link
                href={primaryItem.href}
                className={`${HEADER_FOCUS_RING} no-underline whitespace-nowrap px-2.5 sm:px-3 py-1.5 max-md:inline-flex max-md:items-center max-md:min-h-11 rounded-lg text-white font-semibold text-xs sm:text-sm hover:opacity-90 transition-opacity`}
                style={{ backgroundColor: (verticalConfig as { accentColor?: string }).accentColor || verticalConfig.primaryColor }}
                aria-current={primaryItem.active ? "page" : undefined}
              >
                <span className="lg:hidden">Claim</span>
                <span className="hidden lg:inline">{primaryItem.label}</span>
              </Link>
            )}
            <div className="relative">
              <button type="button" className={`${HEADER_FOCUS_RING} p-2 max-md:p-3 text-gray-600 hover:text-gray-900`} onClick={handleMobileShare} aria-label="Share"><Share2 size={20} /></button>
              {showCopied && <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs bg-gray-800 text-white px-2 py-1 rounded">Link copied</span>}
            </div>
            <details ref={mobileNavRef} className="relative min-[1264px]:hidden">
              <summary className={`${HEADER_FOCUS_RING} flex cursor-pointer list-none items-center gap-2 rounded p-2 max-md:p-3 text-gray-600 hover:text-gray-900`} aria-label="Open primary navigation">
                <span className="hidden sm:inline text-sm font-medium">Menu</span>
                <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </summary>
              <nav id="mobile-primary-navigation" aria-label="Mobile primary navigation" className="absolute right-0 top-full z-10 mt-2 w-72 space-y-3 border bg-white p-4 shadow-lg" onClick={() => { if (mobileNavRef.current) mobileNavRef.current.open = false; }}>
                {renderNavigation(true)}
              </nav>
            </details>
          </div>
        </div>
      </div>
    </header>
  );
}
