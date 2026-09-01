import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import { REGIONS } from "@/lib/constants";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import FooterTagline from "@/components/FooterTagline";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto" style={{ borderTop: `2px solid transparent`, borderImage: `linear-gradient(to right, ${verticalConfig.primaryColor}, transparent) 1` }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <LegalDisclaimer />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="min-w-0">
            <h3 className="text-white font-bold text-lg mb-4 break-words">{verticalConfig.name}</h3>
            <p className="text-sm"><FooterTagline /></p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Regions</h4>
            <ul className="space-y-2 text-sm">
              {REGIONS.slice(0, 6).map((region) => (
                <li key={region.slug}>
                  <Link href={`/${region.slug}`} className="hover:text-white">
                    {region.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/directory" className="hover:text-white">Browse Directory</Link></li>
              <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
              <li><Link href="/owner/login" className="hover:text-white">Owner Login</Link></li>
              <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Related Directories</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="https://doineedapro.com/directories" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-white">
                  Browse all directories &rarr;
                </a>
              </li>
              {verticalConfig.crossReferrals.map((ref) => (
                <li key={ref.url}>
                  <a href={ref.url} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    {ref.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm">&copy; {new Date().getFullYear()} {verticalConfig.name}. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
