/**
 * 🔴 THIS FILE IS CommonJS (`module.exports`), NOT ESM.
 *
 * `botid` documents `import { withBotId } from 'botid/next/config'`. That is the ESM form and
 * it is a BUILD BREAK here. The wrapper is required with `require('botid/next/config')`, and
 * that was verified by actually running it at build step 2 — not assumed at deploy (lane spec
 * §7.1, R-L6).
 *
 * `next` is 14.2.35, so the Next-15.3+ `instrumentation-client.ts` path does NOT apply: the
 * client side is `<BotIdClient protect={…} />` in `app/layout.tsx`'s `<head>`.
 */
const { withBotId } = require("botid/next/config");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["nodemailer"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};
module.exports = withBotId(nextConfig);
