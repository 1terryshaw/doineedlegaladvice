import Link from "next/link";
import { MapPin } from "lucide-react";
import type { NearbyCityResult } from "./haversine";

interface Props {
  cities: NearbyCityResult[];
  /** Province/state code → slug mapping for URL construction */
  regionSlugMap: Record<string, string>;
}

export default function NearYouRow({ cities, regionSlugMap }: Props) {
  if (cities.length === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-semibold text-blue-800">Near you</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {cities.map((city) => {
          const regionSlug = regionSlugMap[city.province] || city.province;
          return (
            <Link
              key={`${city.province}:${city.slug}`}
              href={`/${regionSlug}/${city.slug}`}
              className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 rounded-full text-sm text-blue-800 font-medium transition-colors"
            >
              {city.name}
              <span className="ml-1 text-xs text-blue-500">
                ({Math.round(city.distance)} km)
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
