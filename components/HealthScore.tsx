import type { ListingHealth } from "@/lib/listing-health";
import verticalConfig from "@/lib/vertical.config";

/**
 * Listing health score widget — shows the 0-10 score, a progress bar, and
 * specific actions to improve it. Rendered in the owner dashboard for paid
 * tiers (a Reviews Plus feature).
 */
export default function HealthScore({ health }: { health: ListingHealth }) {
  const { score, max, items } = health;
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const todo = items.filter((it) => !it.met);
  const color = pct >= 80 ? "#16a34a" : pct >= 50 ? "#f59e0b" : "#dc2626";

  return (
    <div className="border rounded-lg p-6 bg-white">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold">Listing health score</h3>
        <span className="text-2xl font-bold" style={{ color }}>
          {score}/{max}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        How complete and optimized your listing is.
      </p>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-4">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {todo.length === 0 ? (
        <p className="text-sm text-green-700">
          Your listing is fully optimized — nice work.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-600 mb-2">To improve your score:</p>
          <ul className="space-y-1.5">
            {todo.map((it) => (
              <li key={it.label} className="text-sm text-gray-700 flex gap-2">
                <span aria-hidden="true" style={{ color: verticalConfig.primaryColor }}>
                  &rarr;
                </span>
                <span>{it.hint}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
