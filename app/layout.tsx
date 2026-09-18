import type { Metadata } from "next";
import "./globals.css";
import verticalConfig from "@/lib/vertical.config";
import { SITE_URL } from "@/lib/seo";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Disclaimer from "@/components/Disclaimer";
import OrgJsonLd from "@/components/OrgJsonLd";
import { BotIdClient } from "botid/client";
import { LANE_PROTECTED_ROUTES } from "@/lib/lane-botid";

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
      </body>
    </html>
  );
}
