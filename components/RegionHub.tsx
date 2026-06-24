import Link from "next/link";

// TDL #657 — the default /directory browse-by-region hub. One section per
// country, each listing its states/provinces with live listing counts, linking
// to the paginated /[region] pages. Replaces the old flat 200-listing render.
export interface HubRegion {
  slug: string;
  name: string;
  count: number;
}
export interface HubSection {
  country: string;
  label: string;
  regions: HubRegion[];
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export default function RegionHub({ sections }: { sections: HubSection[] }) {
  return (
    <div className="space-y-12">
      {sections.map((section) => (
        <section key={section.country} aria-label={section.label}>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            {section.label}
            <span className="text-sm font-normal text-gray-500">
              ({section.regions.length}{" "}
              {section.regions.length === 1 ? "region" : "regions"})
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {section.regions.map((r) => (
              <Link
                key={`${section.country}-${r.slug}`}
                href={`/${r.slug}`}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <span className="font-medium text-gray-900">{r.name}</span>
                <span className="text-sm text-gray-500 tabular-nums">
                  {fmt(r.count)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
