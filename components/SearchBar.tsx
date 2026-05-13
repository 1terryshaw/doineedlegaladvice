"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { REGIONS, LISTING_TYPES } from "@/lib/constants";
import verticalConfig from "@/lib/vertical.config";

interface SearchBarProps {
  variant: "hero" | "directory";
  defaultQ?: string;
  defaultType?: string;
  defaultRegion?: string;
}

export default function SearchBar({
  variant,
  defaultQ = "",
  defaultType = "",
  defaultRegion = "",
}: SearchBarProps) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQ);
  const [type, setType] = useState(defaultType);
  const [region, setRegion] = useState(defaultRegion);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    if (region) params.set("region", region);
    const qs = params.toString();
    router.push(`/directory${qs ? `?${qs}` : ""}`);
  }

  const isHero = variant === "hero";

  return (
    <form onSubmit={handleSubmit} className={isHero ? "w-full max-w-3xl mx-auto" : "w-full"}>
      <div
        className={`flex flex-col sm:flex-row gap-3 ${
          isHero ? "bg-white/10 backdrop-blur-sm p-4 rounded-xl" : "bg-gray-50 p-4 rounded-lg"
        }`}
      >
        <input
          type="text"
          placeholder={`Search ${verticalConfig.listingNounPlural}...`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          {LISTING_TYPES.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Regions</option>
          {REGIONS.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-6 py-2 rounded-lg font-semibold text-white transition-colors"
          style={{ backgroundColor: verticalConfig.primaryColor }}
        >
          Search
        </button>
      </div>
    </form>
  );
}
