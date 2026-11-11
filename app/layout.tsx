import type { Metadata } from "next";
import "./globals.css";
import verticalConfig from "@/lib/vertical.config";
import { SITE_URL, OG_DEFAULT_IMAGE } from "@/lib/seo";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Disclaimer from "@/components/Disclaimer";
import OrgJsonLd from "@/components/OrgJsonLd";
import { BotIdClient } from "botid/client";
import { LANE_PROTECTED_ROUTES } from "@/lib/lane-botid";
import UpgradeIntentCapture from "@/components/UpgradeIntentCapture"; // leads-plus-claim-continuity-v1 (TDL #1360)

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: verticalConfig.name,
    template: `%s | ${verticalConfig.name}`,
  },
  description: verticalConfig.description,
  icons: {
    icon: { url: "/favicon.svg", type: "image/svg+xml" },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: verticalConfig.name,
    images: [{ url: OG_DEFAULT_IMAGE, width: 1200, height: 630, alt: verticalConfig.name }],
  },
  twitter: {
    card: "summary_large_image",
    images: [OG_DEFAULT_IMAGE],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/*
        Vercel BotID, BASIC (free). Next is 14.2.35, so the 15.3+ `instrumentation-client.ts`
        path does not apply — the client arms itself from <head>, and `withBotId()` in
        next.config.js installs the rewrites it needs.

        🔴 `LANE_PROTECTED_ROUTES` is the SAME list the two intake routes check against. A
        route missing from it makes `checkBotId()` on that route fail, so `verify:lane-logic`
        asserts the two sets are equal rather than trusting they were edited together.
      */}
      <head>
        <BotIdClient protect={LANE_PROTECTED_ROUTES.map((r) => ({ path: r.path, method: r.method }))} />
      </head>
      <body className="min-h-screen flex flex-col font-sans">
        <OrgJsonLd />
        <Disclaimer />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <UpgradeIntentCapture />
      </body>
    </html>
  );
}
