"use client";

import { Fragment, useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import verticalConfig from "@/lib/vertical.config";
import { useOwnerAuth } from "@/lib/useOwnerAuth";
import { headerNavigation, type HeaderNavigationItem } from "@/lib/header-navigation";
import { Share2 } from "lucide-react";
import ShareButtons from "@/components/pizzazz/ShareButtons";

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
        ? `${HEADER_FOCUS_RING} ${HEADER_ACTIVE_LINK} ${mobile ? "block text-center" : ""} px-4 py-2 rounded-lg text-white font-semibold text-sm hover:opacity-90 transition-opacity ${item.active ? "ring-2 ring-gray-900 ring-offset-2" : ""}`
        : `${HEADER_FOCUS_RING} ${mobile ? "block" : ""} text-gray-600 hover:text-gray-900 ${item.active ? HEADER_ACTIVE_LINK : ""}`}
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
      className={`${HEADER_FOCUS_RING} ${mobile ? "block" : ""} text-gray-600 hover:text-gray-900`}
    >
      Log Out
    </button>
  );

  // Find a Professional is intentionally last in every state; Log Out belongs
  // immediately before it in authenticated states.
  const renderNavigation = (mobile = false) => navigation.items.map((item, index) => (
    <Fragment key={item.href}>
      {renderItem(item, mobile)}
      {navigation.showLogout && index === navigation.items.length - 2 ? logout(mobile) : null}
    </Fragment>
  ));

  return (
    <header className="border-b bg-white relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className={`${HEADER_FOCUS_RING} text-xl font-bold`} style={{ color: verticalConfig.primaryColor }}>
            {verticalConfig.name}
          </Link>
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-6">
            {renderNavigation()}
            <div className="border-l pl-4 ml-2"><ShareButtons variant="compact" title={verticalConfig.name} /></div>
          </nav>
          <div className="md:hidden flex items-center gap-2">
            <div className="relative">
              <button type="button" className={`${HEADER_FOCUS_RING} p-2 text-gray-600 hover:text-gray-900`} onClick={handleMobileShare} aria-label="Share"><Share2 size={20} /></button>
              {showCopied && <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs bg-gray-800 text-white px-2 py-1 rounded">Link copied</span>}
            </div>
            <details ref={mobileNavRef} className="relative md:hidden">
              <summary className={`${HEADER_FOCUS_RING} flex cursor-pointer list-none items-center gap-2 rounded p-2 text-gray-600 hover:text-gray-900`} aria-label="Open primary navigation">
                <span className="text-sm font-medium">Menu</span>
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
