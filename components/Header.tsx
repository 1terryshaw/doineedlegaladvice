"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import verticalConfig from "@/lib/vertical.config";
import { useOwnerAuth } from "@/lib/useOwnerAuth";
import { Share2 } from "lucide-react";
import ShareButtons from "@/components/pizzazz/ShareButtons";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const { authenticated, slug, loading, refresh } = useOwnerAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleLogout() {
    await fetch("/api/owner/logout", { method: "POST" });
    refresh();
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

  return (
    <header className={`border-b relative z-50 sticky top-0 transition-all duration-300 ${scrolled ? "bg-white/80 backdrop-blur-md shadow-sm" : "bg-white"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-xl font-bold" style={{ color: verticalConfig.primaryColor }}>
            {verticalConfig.name}
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/directory" className="text-gray-600 hover:text-gray-900">
              Directory
            </Link>

            {authenticated && slug ? (
              <>
                <Link href={`/owner/${slug}`} className="text-gray-600 hover:text-gray-900">
                  My Listing
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-gray-600 hover:text-gray-900"
                >
                  Log Out
                </button>
              </>
            ) : !loading && !authenticated ? (
              <>
                <Link href="/owner/login" className="text-gray-600 hover:text-gray-900">
                  Owner Login
                </Link>
                <Link
                  href="/claim"
                  className="px-4 py-2 rounded-lg text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "#d4a373" }}
                >
                  Claim Your Listing
                </Link>
              </>
            ) : null}

            <a
              href={`https://www.instagram.com/${verticalConfig.instagramHandle}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-pink-600 transition-colors"
              aria-label="Instagram"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </a>
          
            <div className="border-l pl-4 ml-2">
              <ShareButtons variant="compact" title={verticalConfig.name} />
            </div>
          </nav>

          {/* Mobile: share button + hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <div className="relative">
              <button
                className="p-2 text-gray-600 hover:text-gray-900"
                onClick={handleMobileShare}
                aria-label="Share"
              >
                <Share2 size={20} />
              </button>
              {showCopied && (
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs bg-gray-800 text-white px-2 py-1 rounded">
                  Link copied
                </span>
              )}
            </div>
            <button
              className="p-2 text-gray-600 hover:text-gray-900"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile slide-down nav */}
        {menuOpen && (
          <nav className="md:hidden border-t py-4 space-y-3">
            <Link href="/directory" className="block text-gray-600 hover:text-gray-900" onClick={() => setMenuOpen(false)}>
              Directory
            </Link>

            {authenticated && slug ? (
              <>
                <Link href={`/owner/${slug}`} className="block text-gray-600 hover:text-gray-900" onClick={() => setMenuOpen(false)}>
                  My Listing
                </Link>
                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="block text-gray-600 hover:text-gray-900"
                >
                  Log Out
                </button>
              </>
            ) : !loading && !authenticated ? (
              <>
                <Link href="/owner/login" className="block text-gray-600 hover:text-gray-900" onClick={() => setMenuOpen(false)}>
                  Owner Login
                </Link>
                <Link
                  href="/claim"
                  className="block text-center px-4 py-2 rounded-lg text-white font-semibold text-sm"
                  style={{ backgroundColor: "#d4a373" }}
                  onClick={() => setMenuOpen(false)}
                >
                  Claim Your Listing
                </Link>
              </>
            ) : null}

            <a
              href={`https://www.instagram.com/${verticalConfig.instagramHandle}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-600 hover:text-pink-600"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
              Instagram
            </a>
          </nav>
        )}
      </div>
    </header>
  );
}
