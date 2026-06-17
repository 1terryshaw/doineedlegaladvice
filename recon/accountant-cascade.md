# Accountant /directory SearchBar UK cascade — recon (S3 Phase A1)

Donor: `~/empire/nav-fix/doineedanaccountant`. Files: `components/SearchBar.tsx` (cascade
component) + `app/directory/page.tsx` (caller that supplies UK data).

## Pattern

- **Granularity = county → town cascade** (NOT nations). UK **counties** appear in the
  region `<select>` as an `<optgroup label="🇬🇧 United Kingdom">`; selecting one populates
  the city `<select>` with that county's **town hubs** (≥3 firms).
- Data comes from the **is_published-gated stat views** (`getUkCounties()` +
  `getUkAllTownHubs()`), so every dropdown option resolves to a live 200 page.
- **Additive optional props** on SearchBar: `ukCounties?: {slug,name,count?}[]` and
  `ukTowns?: {countySlug,slug,name}[]`. When omitted (every non-UK call site) the component
  renders byte-for-byte as before.
- **Value namespacing:** UK county option values are prefixed `uk:` (`UK_PREFIX`) to stay
  distinct from CA/US 2-letter province codes, so submit routing branches unambiguously.
- **Submit routing:** UK selections do **NOT** hit `/directory` results — they
  `router.push('/uk/<county>')` or `/uk/<county>/<town>` (the Session-2 hub pages). So no
  UK results page and no `uk_*` query in `/directory` is needed.
- **City placeholder:** "All Towns" when a UK county is selected, else "All Cities".
- **Caller (`app/directory/page.tsx`):** fail-open fetch of counties+town hubs, mapped to
  the prop shape, passed only to the `/directory` SearchBar. The **homepage** SearchBar is
  left UK-less (byte-identical).

## Confirmed for this repo

`diff` of this repo's `components/SearchBar.tsx` vs accountant's = **UK cascade only**; the
two bases are otherwise byte-identical. So the accountant SearchBar can be reproduced exactly
here. This repo already has `getUkCounties()` + `getUkAllTownHubs()` in `lib/uk-solicitors.ts`
(Session 2) returning the same shapes the caller needs.
