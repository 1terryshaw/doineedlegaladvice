import Link from "next/link";

// TDL #657 — URL-driven pagination shared by region pages and the /directory
// search view. Pass `totalPages` for numbered pagination (region pages, whose
// totals come cheaply from the region-counts matview) or just `hasNext` for
// prev/next-only (text/specialty search, where an exact count is expensive).
interface PaginationProps {
  currentPage: number;
  basePath: string;
  totalPages?: number;
  hasNext?: boolean;
  /** Existing query params to preserve across pages (page is managed here). */
  params?: Record<string, string>;
}

function hrefFor(basePath: string, params: Record<string, string>, page: number): string {
  const sp = new URLSearchParams(params);
  if (page <= 1) sp.delete("page");
  else sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

// Windowed page list: 1 … (cur-2 … cur+2) … last, with `null` marking gaps.
function pageWindow(current: number, total: number): (number | null)[] {
  const span = 2;
  const pages = new Set<number>([1, total]);
  for (let p = current - span; p <= current + span; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push(null);
    out.push(p);
    prev = p;
  }
  return out;
}

export default function Pagination({
  currentPage,
  basePath,
  totalPages,
  hasNext,
  params = {},
}: PaginationProps) {
  const cur = Math.max(1, currentPage);
  const numbered = typeof totalPages === "number" && totalPages > 0;
  const lastPage = numbered ? (totalPages as number) : undefined;

  const showNext = numbered ? cur < (lastPage as number) : !!hasNext;
  const showPrev = cur > 1;

  if (!showPrev && !showNext) return null;

  const linkClass =
    "inline-flex items-center justify-center min-w-[2.5rem] px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50";
  const activeClass =
    "inline-flex items-center justify-center min-w-[2.5rem] px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold";
  const disabledClass =
    "inline-flex items-center justify-center px-3 py-2 rounded-lg border border-gray-100 text-sm font-medium text-gray-300 cursor-not-allowed";

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex flex-wrap items-center justify-center gap-2"
    >
      {showPrev ? (
        <Link rel="prev" href={hrefFor(basePath, params, cur - 1)} className={linkClass}>
          ← Prev
        </Link>
      ) : (
        <span className={disabledClass}>← Prev</span>
      )}

      {numbered &&
        pageWindow(cur, lastPage as number).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-2 text-gray-400 select-none">
              …
            </span>
          ) : p === cur ? (
            <span key={p} aria-current="page" className={activeClass}>
              {p}
            </span>
          ) : (
            <Link key={p} href={hrefFor(basePath, params, p)} className={linkClass}>
              {p}
            </Link>
          )
        )}

      {!numbered && (
        <span className="px-3 py-2 text-sm text-gray-500">Page {cur}</span>
      )}

      {showNext ? (
        <Link rel="next" href={hrefFor(basePath, params, cur + 1)} className={linkClass}>
          Next →
        </Link>
      ) : (
        <span className={disabledClass}>Next →</span>
      )}
    </nav>
  );
}
