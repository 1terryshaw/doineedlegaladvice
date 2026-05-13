"use client";

import { DAY_KEYS, DAY_LABELS, DayKey, DayHours, HoursJson, emptyHours } from "@/lib/listing-extras";

interface Props {
  value: HoursJson | null;
  onChange: (next: HoursJson) => void;
}

export default function HoursEditor({ value, onChange }: Props) {
  const hours: HoursJson = value || emptyHours();

  function update(day: DayKey, patch: Partial<DayHours>) {
    onChange({ ...hours, [day]: { ...hours[day], ...patch } });
  }

  function copyFromPrevious(day: DayKey) {
    const idx = DAY_KEYS.indexOf(day);
    if (idx <= 0) return;
    const prev = hours[DAY_KEYS[idx - 1]];
    onChange({ ...hours, [day]: { ...prev } });
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Business hours</label>
      <small className="block text-gray-500 mb-3">
        Closed/24hr toggles available per day. Weekly hours show on your listing.
      </small>
      <div className="space-y-2">
        {DAY_KEYS.map((d, i) => {
          const row = hours[d];
          const mode = row.closed ? "closed" : row.open24 ? "open24" : "custom";
          return (
            <div key={d} className="flex flex-wrap items-center gap-2 py-1">
              <div className="w-12 text-sm font-medium text-gray-700">{DAY_LABELS[d]}</div>
              <select
                value={mode}
                onChange={(e) => {
                  const v = e.target.value;
                  update(d, {
                    closed: v === "closed",
                    open24: v === "open24",
                  });
                }}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="closed">Closed</option>
                <option value="open24">24 hours</option>
                <option value="custom">Custom</option>
              </select>
              {mode === "custom" && (
                <>
                  <input
                    type="time"
                    value={row.opens}
                    onChange={(e) => update(d, { opens: e.target.value })}
                    className="border rounded px-2 py-1 text-sm"
                  />
                  <span className="text-sm text-gray-500">to</span>
                  <input
                    type="time"
                    value={row.closes}
                    onChange={(e) => update(d, { closes: e.target.value })}
                    className="border rounded px-2 py-1 text-sm"
                  />
                </>
              )}
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => copyFromPrevious(d)}
                  className="text-xs text-blue-700 hover:underline ml-auto"
                >
                  Copy from {DAY_LABELS[DAY_KEYS[i - 1]]}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
