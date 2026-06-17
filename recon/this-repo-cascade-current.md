# This repo's current /directory SearchBar — recon (S3 Phase A2)

- **SearchBar:** `components/SearchBar.tsx` (184 lines). Region `<select>` built from
  `regions` prop (runtime DirectoryRegions) / config; CA + US optgroups. Submit `router.push`
  to `/directory?...`. **No UK option today.** Byte-identical base to accountant's pre-UK SearchBar.
- **Render sites (2):**
  - `app/page.tsx:130` — `<SearchBar variant="directory" />` (homepage). Will stay UK-less (matches accountant).
  - `app/directory/page.tsx:60` — `<SearchBar variant="directory" defaultQ defaultType defaultRegion defaultCity regions />`. ← UK props added here only.
- **Data layer ready:** `lib/uk-solicitors.ts` exports `getUkCounties()` (CountyStat: county,
  county_slug, firm_count) + `getUkAllTownHubs()` (TownStat: county, town, county_slug,
  town_slug, firm_count) — exactly what the caller maps into the UK props.
- **No new results page needed:** UK routes to the existing `/uk/[county]` and
  `/uk/[county]/[town]` hubs (Session 2). No `uk_solicitors` query added to `/directory`.

## Proposed plan (2 files, additive)

1. **`components/SearchBar.tsx`** — reproduce the accountant UK cascade (optional `ukCounties`/
   `ukTowns` props + `uk:` namespaced optgroup + UK submit branch + "All Towns" label). Bases
   are byte-identical, so this is the proven accountant artifact. Every existing call site that
   omits the props (homepage + all US/CA) renders unchanged.
2. **`app/directory/page.tsx`** — import `getUkCounties`/`getUkAllTownHubs` from
   `@/lib/uk-solicitors`; fail-open fetch; map; pass `ukCounties`/`ukTowns` to the `/directory`
   SearchBar only. Existing US/CA dropdown options + `/directory` result routing untouched.

**Risk to US/CA:** SearchBar is shared, but props are optional → all existing call sites
byte-identical. `/directory` page gains only the UK fetch + 2 props. Verify via curl-diff
(semantic markup) on `/`, `/directory`, `/ca`, `/ca/los-angeles`, `/ny`, `/tx`, `/fl`. No
middleware, no data changes.
