"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import CityPillGrid, { type CityPill } from "./CityPillGrid";

interface Props {
  name: string;
  code: string;
  cities: CityPill[];
  defaultExpanded: boolean;
}

export default function StateAccordion({ name, code, cities, defaultExpanded }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-2 px-3 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={expanded}
      >
        <span className="font-medium text-gray-800 text-sm">
          {name}
          <span className="ml-2 text-xs text-gray-400">({cities.length})</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          style={{ transitionDuration: "150ms" }}
        />
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          <CityPillGrid cities={cities} />
        </div>
      )}
    </div>
  );
}
