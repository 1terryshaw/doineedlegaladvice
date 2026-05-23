"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { REGIONS, LISTING_TYPES } from "@/lib/constants";
import verticalConfig from "@/lib/vertical.config";
import { CANADIAN_PROVINCES, US_STATES } from "@/lib/provinces";

type RegionShape = { slug: string; name: string; province: string };

interface SearchBarProps {
  variant: "hero" | "directory";
  defaultQ?: string;
  defaultType?: string;
  defaultRegion?: string;
  defaultCity?: string;
  regions?: RegionShape[];
}

// FIX-EMPIRE-CASCADING-SWEEP — strip the `-<prov>` collision suffix added by
// getDirectoryRegions(). The cascading form pins the province explicitly, so
// the suffix is redundant downstream.
function stripCollisionSuffix(slug: string, province: string): string {
  const suffix = `-${province.toLowerCase()}`;
  return slug.endsWith(suffix) ? slug.slice(0, -suffix.length) : slug;
}

export default function SearchBar({
  variant,
  defaultQ = "",
  defaultType = "",
  defaultRegion = "",
  defaultCity = "",
  regions,
}: SearchBarProps) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQ);
  const [type, setType] = useState(defaultType);
  const [province, setProvince] = useState(defaultRegion.toUpperCase());
  const [city, setCity] = useState(defaultCity);

  const regionList: RegionShape[] =
    regions && regions.length > 0 ? regions : (REGIONS as RegionShape[]);

  // Dropdown 1: source from canonical lib/provinces.ts (CANADIAN_PROVINCES +
  // US_STATES + literal DC). 64 entries total. Static REGIONS is multi-source
  // derived and lossy — see canonical-components/runtime-regions.md.
  const provinceList = useMemo(() => {
    const labels =
      (verticalConfig as { provinceLabels?: Record<string, string> })
        .provinceLabels || {};
    const toEntry = (r: { code: string; name: string }) => ({
      code: r.code,
      label: labels[r.code] || r.name,
    });
    const ca = CANADIAN_PROVINCES.map(toEntry).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
    const us = [...US_STATES, { code: "DC", name: "District of Columbia" }]
      .map(toEntry)
      .sort((a, b) => a.label.localeCompare(b.label));
    return { ca, us };
  }, []);

  // Dropdown 2: cities for the selected province, from runtime regions prop.
  // Empty when no province selected — dropdown disabled.
  const cityOptions = useMemo(() => {
    if (!province) return [] as { slug: string; name: string }[];
    return regionList
      .filter((r) => r.province.toUpperCase() === province)
      .map((r) => ({
        slug: stripCollisionSuffix(r.slug, r.province),
        name: r.name,
      }))
      .filter(
        (entry, idx, arr) =>
          arr.findIndex((e) => e.slug === entry.slug) === idx
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [regionList, province]);

  function onProvinceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setProvince(e.target.value);
    setCity("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("listing_type", type);
    if (province) params.set("region", province);
    if (province && city) params.set("city", city);
    const qs = params.toString();
    router.push(`/directory${qs ? `?${qs}` : ""}`);
  }

  const isHero = variant === "hero";

  const supportedCountries =
    (verticalConfig as { supportedCountries?: readonly string[] }).supportedCountries ?? ["CA"];
  const supportsUS = supportedCountries.includes("US");

  return (
    <form onSubmit={handleSubmit} className={isHero ? "w-full max-w-3xl mx-auto" : "w-full"}>
      <div
        className={`flex flex-col sm:flex-row gap-3 ${
          isHero ? "bg-white/10 backdrop-blur-sm p-4 rounded-xl" : "bg-gray-50 p-4 rounded-lg"
        }`}
      >
        <input
          type="text"
          placeholder={`Search ${verticalConfig.listingNounPlural} by name...`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Specialties</option>
          {LISTING_TYPES.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={province}
          onChange={onProvinceChange}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Regions</option>
          {supportsUS ? (
            <>
              <optgroup label="🇨🇦 Canada">
                {provinceList.ca.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🇺🇸 United States">
                {provinceList.us.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            </>
          ) : (
            provinceList.ca.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))
          )}
        </select>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          disabled={!province}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          <option value="">{province ? "All Cities" : "Select region first"}</option>
          {cityOptions.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
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
