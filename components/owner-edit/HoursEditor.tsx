"use client";

import { DAY_KEYS, DAY_LABELS, DayKey, DayHours, HoursJson } from "@/lib/listing-extras";

interface Props {
  value: HoursJson | null;
  onChange: (next: HoursJson) => void;
}

// What a day becomes when the owner explicitly clicks "Set hours" on a not-set day.
const NEW_DAY: DayHours = { closed: false, open24: false, opens: "09:00", closes: "17:00" };

// A stored row may carry any subset of the seven days. A missing (or malformed) day is
// "not set": it renders as such and is never written back unless the owner sets it here.
function dayOf(hours: HoursJson, day: DayKey): DayHours | null {
  const d = hours[day];
  return d && typeof d === "object" ? d : null;
}

export default function HoursEditor({ value, onChange }: Props) {
  const hours: HoursJson = value && typeof value === "object" ? value : {};

  function update(day: DayKey, patch: Partial<DayHours>) {
    const cur = dayOf(hours, day) ?? NEW_DAY;
    onChange({ ...hours, [day]: { ...cur, ...patch } });
  }

  function clearDay(day: DayKey) {
    const next: HoursJson = { ...hours };
    delete next[day];
    onChange(next);
  }

  function copyFromPrevious(day: DayKey) {
    const idx = DAY_KEYS.indexOf(day);
    if (idx <= 0) return;
    const prev = dayOf(hours, DAY_KEYS[idx - 1]);
    if (!prev) return;
    onChange({ ...hours, [day]: { ...prev } });
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Business hours</label>
      <small className="block text-gray-500 mb-3">
        Closed/24hr toggles available per day. Weekly hours show on your listing. Days you leave
        &ldquo;Not set&rdquo; are left off your listing.
      </small>
      <div className="space-y-2">
        {DAY_KEYS.map((d, i) => {
          const row = dayOf(hours, d);
          const prevSet = i > 0 && !!dayOf(hours, DAY_KEYS[i - 1]);
          const mode = row ? (row.closed ? "closed" : row.open24 ? "open24" : "custom") : null;
          return (
            <div key={d} data-hours-day={d} data-hours-set={row ? "1" : "0"} className="flex flex-wrap items-center gap-2 py-1">
              <div className="w-12 text-sm font-medium text-gray-700">{DAY_LABELS[d]}</div>
              {row ? (
                <>
                  <select
                    value={mode ?? "custom"}
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
                  <div className="ml-auto flex gap-3">
                    {prevSet && (
                      <button
                        type="button"
                        onClick={() => copyFromPrevious(d)}
                        className="text-xs text-blue-700 hover:underline whitespace-nowrap"
                      >
                        Copy from {DAY_LABELS[DAY_KEYS[i - 1]]}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => clearDay(d)}
                      className="text-xs text-gray-500 hover:underline whitespace-nowrap"
                    >
                      Clear
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-sm text-gray-500">Not set</span>
                  <div className="ml-auto flex gap-3">
                    {prevSet && (
                      <button
                        type="button"
                        onClick={() => copyFromPrevious(d)}
                        className="text-xs text-blue-700 hover:underline whitespace-nowrap"
                      >
                        Copy from {DAY_LABELS[DAY_KEYS[i - 1]]}
                      </button>
                    )}
                    <button
                      type="button"
                      data-hours-set-btn
                      onClick={() => update(d, {})}
                      className="text-xs text-blue-700 hover:underline whitespace-nowrap"
                    >
                      Set hours
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
