import type { Metadata } from "next";
import "./globals.css";
import verticalConfig from "@/lib/vertical.config";
import { SITE_URL, organizationSchema } from "@/lib/seo";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Disclaimer from "@/components/Disclaimer";

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
      <body className="min-h-screen flex flex-col font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema()) }}
        />
        <Disclaimer />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
