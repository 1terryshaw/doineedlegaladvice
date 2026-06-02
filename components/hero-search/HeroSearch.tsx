"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Province {
  code: string;
  name: string;
  country: string;
}

interface City {
  name: string;
  slug: string;
  province: string;
  listing_count?: number;
}

interface Props {
  provinces: Province[];
  cities: City[];
  vertical: string;
  placeholder?: string;
  trustCopy?: string;
  accentClass?: string;
  destination?: string;
}

const TRUST_DEFAULTS: Record<string, string> = {
  realestate: "Trusted by thousands of homeowners and homebuyers",
  plumber: "Trusted by thousands of homeowners",
  caterer: "Trusted by event hosts",
  electrician: "Trusted by thousands of homeowners",
  hvac: "Trusted by thousands of homeowners",
  landscaper: "Trusted by homeowners and property managers",
  roofer: "Trusted by thousands of homeowners",
  mechanic: "Trusted by drivers",
  florist: "Trusted by event planners and gift-givers",
  photographer: "Trusted by couples, families, and businesses",
  dentist: "Trusted by families",
  chiropractor: "Trusted by patients",
};

export default function HeroSearch({
  provinces,
  cities,
  vertical,
  placeholder = "Search by name or keyword...",
  trustCopy,
  accentClass = "bg-blue-600 hover:bg-blue-700",
  destination = "/directory",
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");

  const visibleProvinces = useMemo(() => {
    const used = new Set(cities.map((c) => c.province));
    return provinces.filter((p) => used.has(p.code));
  }, [provinces, cities]);

  const citiesForRegion = useMemo(
    () =>
      region
        ? cities
            .filter((c) => c.province === region)
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [cities, region],
  );

  const handleRegionChange = (val: string) => {
    setRegion(val);
    setCity("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    const trimmed = q.trim();
    if (trimmed) params.set("q", trimmed);
    if (region) params.set("region", region);
    if (city) params.set("city", city);
    const qs = params.toString();
    router.push(`${destination}${qs ? `?${qs}` : ""}`);
  };

  const trust =
    trustCopy ?? TRUST_DEFAULTS[vertical] ?? "Trusted by professionals across the directory";

  return (
    <section className="bg-gray-50 border-b border-gray-200 py-8 px-4" data-testid="hero-search">
      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto" role="search">
        <div className="flex flex-col md:flex-row gap-2 md:gap-3">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            aria-label="Search by name or keyword"
            className="flex-1 min-h-[44px] px-4 py-3 rounded-lg text-gray-900 placeholder-gray-400 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
          />
          <select
            value={region}
            onChange={(e) => handleRegionChange(e.target.value)}
            aria-label="Province or state"
            className="min-h-[44px] md:w-44 px-3 py-3 rounded-lg text-gray-900 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Provinces</option>
            {visibleProvinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={!region}
            aria-label="City"
            className="min-h-[44px] md:w-44 px-3 py-3 rounded-lg text-gray-900 bg-white border border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {!region ? (
              <option value="">Select province first</option>
            ) : (
              <>
                <option value="">All Cities</option>
                {citiesForRegion.map((c) => (
                  <option key={`${c.province}:${c.slug}`} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </>
            )}
          </select>
          <button
            type="submit"
            className={`min-h-[44px] px-6 py-3 text-white rounded-lg font-semibold transition-colors ${accentClass}`}
          >
            Search
          </button>
        </div>
        <p className="mt-3 text-sm text-gray-500 text-center md:text-left">{trust}</p>
      </form>
    </section>
  );
}
