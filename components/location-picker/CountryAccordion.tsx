"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import StateAccordion from "./StateAccordion";
import type { CityPill } from "./CityPillGrid";

export interface StateData {
  code: string;
  name: string;
  cities: CityPill[];
}

interface Props {
  countryCode: string;
  countryName: string;
  flag: string;
  states: StateData[];
  defaultExpanded: boolean;
  visitorRegion: string | null;
}

export default function CountryAccordion({
  countryCode,
  countryName,
  flag,
  states,
  defaultExpanded,
  visitorRegion,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const totalCities = states.reduce((sum, s) => sum + s.cities.length, 0);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left bg-white hover:bg-gray-50 transition-colors"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2 font-semibold text-gray-900">
          <span className="text-xl">{flag}</span>
          {countryName}
          <span className="text-sm font-normal text-gray-400">
            ({totalCities} {totalCities === 1 ? "city" : "cities"})
          </span>
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          style={{ transitionDuration: "150ms" }}
        />
      </button>
      {expanded && (
        <div className="border-t border-gray-200 bg-white">
          {states.map((state) => (
            <StateAccordion
              key={state.code}
              name={state.name}
              code={state.code}
              cities={state.cities}
              defaultExpanded={visitorRegion === state.code}
            />
          ))}
        </div>
      )}
    </div>
  );
}
