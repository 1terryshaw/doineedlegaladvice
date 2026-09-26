import type { Metadata } from "next";
import type { ReactNode } from "react";
import verticalConfig from "@/lib/vertical.config";
import { SITE_URL } from "@/lib/seo";

// owner-next-step-card-canary-v1: public, forwardable owner guides. The same approved copy
// will live on many sites, so every guide is noindex,follow and stays OUT of the sitemap
// (app/sitemap/[id]/route.ts lists static paths explicitly — never add /guides there).

export const DIRECTORY_NAME = verticalConfig.name;
// This site has no /owner index route (it would 404), so the owner entry is /owner/login.
export const CONNECT_GOOGLE_LINK = `${SITE_URL}/owner/login`;
export const SUPPORT_EMAIL = (verticalConfig as { supportEmail?: string }).supportEmail || "";

export function guideMetadata(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      url: path,
      title,
      description,
      siteName: verticalConfig.name,
    },
    twitter: { card: "summary", title, description },
  };
}

const primary = verticalConfig.primaryColor;

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xl sm:text-2xl font-bold mt-10 mb-3" style={{ color: primary }}>
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="font-semibold text-gray-900 mt-6 mb-2">{children}</h3>;
}

export function ConnectLink() {
  return (
    <a href={CONNECT_GOOGLE_LINK} className="font-medium underline break-all" style={{ color: primary }}>
      {CONNECT_GOOGLE_LINK}
    </a>
  );
}

export default function GuideShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <article className="max-w-3xl mx-auto px-4 py-10 sm:py-14 text-gray-700 leading-relaxed">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h1>
      <p className="mt-2 text-gray-500">{subtitle}</p>
      {children}
      <p className="mt-12 border-t pt-6 text-sm text-gray-600" data-guide-footer>
        Know another business owner who&apos;d find this useful? Forward it along. Their listing on{" "}
        {DIRECTORY_NAME} is free to claim.
      </p>
    </article>
  );
}
