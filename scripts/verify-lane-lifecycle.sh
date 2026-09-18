#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════════════
# LAYER 2 — THE DDL, THE CONSTRAINTS AND THE GRANTS, ON A REAL ENGINE.
# (newbiz-submissions-dinla-lane-build-v1, spec §8.2.)
#
# 🔴 IT INSTALLS THE F-1 HOSTILE DEFAULT ACL FIRST, THEN RUNS THE MIGRATION.
#
# The directory Supabase project's measured state is:
#   supabase_admin | public | {postgres=arwdDxtm/…, anon=arwdDxtm/…, authenticated=arwdDxtm/…}
# — every new table in `public` is BORN with ALL privileges granted to anon. This harness
# REPRODUCES that trap on a real engine instead of describing it, and then asserts the three
# lane tables still end up RLS-on with ZERO anon/authenticated grants. A lockdown tail that is
# only argued for is not a lockdown tail.
#
# ── ISOLATION ────────────────────────────────────────────────────────────────────────
# A SOCKET-ONLY cluster: `listen_addresses=''` and no TCP port at all, so it cannot collide
# with another session's server and cannot be reached from off-host. Ports are inspected with
# `ss`, NEVER `lsof` (`feedback_lsof_returns_nothing_use_ss` — lsof returns nothing on this box
# and a silent port guard fails open). Nothing belonging to another session is touched or
# killed. The cluster is torn down on EXIT, INCLUDING ON FAILURE.
# ══════════════════════════════════════════════════════════════════════════════════════
set -uo pipefail

PGBIN=/usr/lib/postgresql/17/bin
RUN=$(mktemp -d "${TMPDIR:-/tmp}/lane-lifecycle-XXXXXX")
DATA="$RUN/data"
SOCK="$RUN/sock"
PASS=0
FAIL=0

cleanup() {
  local rc=$?
  if [ -d "$DATA" ]; then "$PGBIN/pg_ctl" -D "$DATA" -m immediate -w stop >/dev/null 2>&1 || true; fi
  rm -rf "$RUN"
  exit "$rc"
}
# EXIT covers the success path, the `set -e`-less failure paths and every signal.
trap cleanup EXIT INT TERM

ok()   { PASS=$((PASS+1)); echo "PASS  $1${2:+  ·  $2}"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL  $1${2:+  ·  $2}"; }
check(){ if [ "$2" = "$3" ]; then ok "$1" "$2"; else bad "$1" "expected [$3] got [$2]"; fi; }

if [ ! -x "$PGBIN/initdb" ]; then
  echo "FAIL  pg17 server binaries absent at $PGBIN — Layer 2 CANNOT run, which is a failure, not a skip."
  exit 1
fi

mkdir -p "$SOCK"
"$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null 2>&1 || { echo "FAIL initdb"; exit 1; }
# listen_addresses='' + port disabled: a UNIX socket only. `ss` confirms we bound no TCP port.
"$PGBIN/pg_ctl" -D "$DATA" -w -o "-c listen_addresses='' -c unix_socket_directories=$SOCK" -l "$RUN/pg.log" start >/dev/null 2>&1 \
  || { echo "FAIL pg_ctl start"; sed -n '1,40p' "$RUN/pg.log"; exit 1; }

export PGHOST="$SOCK" PGUSER=postgres PGDATABASE=postgres
# `-q` matters: without it psql echoes the command tag ("INSERT 0 1") after a RETURNING row,
# and every value comparison below picks up a second line it did not ask for.
Q() { psql -q -v ON_ERROR_STOP=1 -tAc "$1" 2>&1; }

# ── ISOLATION PROOF — we bound no TCP port. `ss`, never `lsof`. ──
LISTENERS=$(ss -ltnp 2>/dev/null | grep -c "$(cat "$DATA/postmaster.pid" | head -1)" || true)
check "L2-0 the harness cluster binds NO TCP port (socket-only; checked with ss, never lsof)" "$LISTENERS" "0"

# ── THE SUPABASE ROLE SET, then 🔴 THE F-1 HOSTILE DEFAULT ACL ──
Q "create role anon nologin; create role authenticated nologin; create role service_role nologin;
   grant usage on schema public to anon, authenticated, service_role;
   alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
   alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
   create extension if not exists pgcrypto; create extension if not exists pg_trgm;
   create extension if not exists unaccent;" >/dev/null
HOSTILE=$(Q "select count(*) from pg_default_acl where defaclobjtype='r' and defaclacl::text like '%anon=%'")
check "L2-1 🔴 the F-1 hostile default ACL is INSTALLED before the migration (anon gets ALL on every new table)" "$HOSTILE" "1"

# ── THE MIGRATION, UNMODIFIED ──
if psql -v ON_ERROR_STOP=1 -q -f migrations/2026-09-18_legal_submitted_listing.sql >"$RUN/mig.log" 2>&1; then
  ok "L2-2 the lane migration applies cleanly, unmodified"
else
  bad "L2-2 the lane migration applies cleanly, unmodified" "$(tail -3 "$RUN/mig.log" | tr '\n' ' ')"
fi

# ── 🔴 THE LOCKDOWN TAIL BEAT THE HOSTILE DEFAULT ──
for T in legal_submitted_listing legal_submitted_listing_history legal_submitted_email_delivery; do
  RLS=$(Q "select relrowsecurity from pg_class where relname='$T'")
  check "L2-3 $T has RLS ENABLED" "$RLS" "t"
  POL=$(Q "select count(*) from pg_policies where tablename='$T'")
  check "L2-4 $T has ZERO policies (RLS on + no policy = no access even if a grant survived)" "$POL" "0"
  GRANTS=$(Q "select count(*) from information_schema.role_table_grants where table_name='$T' and grantee in ('anon','authenticated','PUBLIC')")
  check "L2-5 🔴 $T grants NOTHING to anon/authenticated/PUBLIC despite the hostile default ACL" "$GRANTS" "0"
  # ⚠️ NOT an equality assertion, and the reason is a real finding rather than a loosened test.
  # The F-1 hostile default ACL grants ALL to service_role as well as to anon, and the spec's
  # lockdown tail deliberately revokes only anon/authenticated/PUBLIC — so service_role keeps
  # the surplus (DELETE, TRUNCATE, …) on the real project too. What the tail GUARANTEES is the
  # superset, and asserting equality here would be asserting something the production database
  # does not do. The full set is printed so a change to it is visible rather than silent.
  SR=$(Q "select count(*) from information_schema.role_table_grants where table_name='$T' and grantee='service_role' and privilege_type in ('SELECT','INSERT','UPDATE')")
  SRALL=$(Q "select string_agg(distinct privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_name='$T' and grantee='service_role'")
  check "L2-6 $T grants SELECT+INSERT+UPDATE to service_role (actual set: $SRALL)" "$SR" "3"
done
for S in legal_submitted_listing_history_id_seq legal_submitted_email_delivery_id_seq; do
  SEQ=$(Q "select count(*) from information_schema.role_usage_grants where object_name='$S' and grantee in ('anon','authenticated','PUBLIC')")
  check "L2-7 sequence $S grants nothing to anon/authenticated/PUBLIC" "$SEQ" "0"
done

# ── EVERY CHECK FIRES, AND WE READ ITS SQLSTATE ──
#
# 🔴 UNDER `VERBOSITY=verbose`. The donor harness read every refusal as `none` and then as
# `ERROR`, and so could not see twelve constraints firing correctly — a harness that cannot
# distinguish "the right constraint fired" from "something went wrong" is not testing the
# constraints, it is testing that the insert failed.
# Verbose psql prints `ERROR:  23514: <message>` and a separate `CONSTRAINT NAME:  <name>`
# line. Both are parsed, because the SQLSTATE alone says only "a check failed" — it is the
# NAME that says WHICH one, and "the right constraint fired" is the thing under test.
SQLSTATE_OF() {
  psql -q -v ON_ERROR_STOP=0 -v VERBOSITY=verbose -tAc "$1" 2>&1 \
    | sed -nE 's/^ERROR:  ([0-9A-Z]{5}):.*/\1/p' | head -1
}
NAME_OF() {
  psql -q -v ON_ERROR_STOP=0 -v VERBOSITY=verbose -tAc "$1" 2>&1 \
    | grep -E '^CONSTRAINT NAME:' | sed -E 's/^CONSTRAINT NAME: +//' | head -1
}
BASE="insert into legal_submitted_listing (business_name, city, region_state, submitted_by_email, slug"
VALS="values ('Acme','Portland','OR','a@b.co','s1'"

CONSTRAINT_CASES=(
  "lsl_status_check|$BASE, submission_status) $VALS, 'nope')"
  "lsl_region_resolution_check|$BASE, region_resolution) $VALS, 'MAYBE')"
  "lsl_finder_resolution_check|$BASE, finder_resolution) $VALS, 'MATCH')"
  "lsl_country_us_only|$BASE, country) $VALS, 'CA')"
  "lsl_region_shape|$BASE) values ('Acme','Portland','or','a@b.co','s1')"
  "lsl_publish_requires_verified|$BASE, is_published, published_at) $VALS, true, now())"
  "lsl_verified_has_timestamp|$BASE, submission_status) $VALS, 'verified')"
  "lsl_published_has_timestamp|$BASE, submission_status, verified_at, is_published) $VALS, 'verified', now(), true)"
  # (tested separately, below — it is unreachable by INSERT)
  "lsl_name_nonempty|insert into legal_submitted_listing (business_name, city, region_state, submitted_by_email, slug) values ('   ','Portland','OR','a@b.co','s1')"
  "lsl_slug_nonempty|$BASE) values ('Acme','Portland','OR','a@b.co','  ')"
  "lsl_email_nonempty|$BASE) values ('Acme','Portland','OR','   ','s1')"
  "lsl_attempts_sane|$BASE, verify_failed_attempts) $VALS, -1)"
  "lsl_verify_expiry_future|$BASE, verify_token_expires_at) $VALS, now() - interval '1 day')"
  "lsl_session_expiry_future|$BASE, owner_session_expires_at) $VALS, now() - interval '1 day')"
)
for CASE in "${CONSTRAINT_CASES[@]}"; do
  WANT="${CASE%%|*}"; SQL="${CASE#*|}"
  STATE=$(SQLSTATE_OF "$SQL"); GOT=$(NAME_OF "$SQL")
  if [ "$STATE" = "23514" ] && [ "$GOT" = "$WANT" ]; then
    ok "L2-8 CHECK $WANT fires" "SQLSTATE=23514"
  else
    bad "L2-8 CHECK $WANT fires" "SQLSTATE=[$STATE] constraint=[$GOT]"
  fi
done

# The happy row, so the refusals above are not passing because EVERY insert fails.
# 🔴 lsl_terminal_is_unpublished IS AN UPDATE-PATH CONSTRAINT. Its job is to stop a LIVE row
# being marked withdrawn/removed while it is still published — which is exactly the shape a
# partial withdrawal would take. An INSERT can never reach it (lsl_publish_requires_verified
# rejects the row first), so it is exercised the way it is actually used.
TERM_SETUP=$(Q "insert into legal_submitted_listing (business_name, city, region_state, submitted_by_email, slug, submission_status, verified_at, is_published, published_at) values ('Term','P','OR','t@t.co','term-row','verified', now(), true, now()) returning slug")
check "L2-8a a verified+published row exists to test the UPDATE-path constraint against" "$TERM_SETUP" "term-row"
TERM_STATE=$(SQLSTATE_OF "update legal_submitted_listing set submission_status='withdrawn' where slug='term-row'")
TERM_NAME=$(NAME_OF "update legal_submitted_listing set submission_status='withdrawn' where slug='term-row'")
# 🔴 A FINDING, NOT A LOOSENED ASSERTION. `lsl_terminal_is_unpublished` is IMPLIED BY
# `lsl_publish_requires_verified`: a terminal status is by definition not 'verified', so any
# row with is_published=true and status in (withdrawn, removed) violates BOTH, and Postgres
# reports whichever it evaluates first — here, publish_requires_verified. The terminal
# constraint is therefore defence in depth rather than an independently reachable rule, which
# is what the spec's ladder intends and is worth having: if publish_requires_verified were ever
# relaxed, this one still stops a withdrawn row serving.
#
# So the assertion is the PROPERTY (the update is refused, by one of the two constraints that
# encode it), stated with which one actually fired — not a pretence that the weaker one can be
# isolated. Naming a constraint the engine can never report would be a test that passes only
# by being wrong about the schema.
if [ "$TERM_STATE" = "23514" ] && { [ "$TERM_NAME" = "lsl_terminal_is_unpublished" ] || [ "$TERM_NAME" = "lsl_publish_requires_verified" ]; }; then
  ok "L2-8b 🔴 a published row CANNOT be marked withdrawn without being unpublished (refused by the terminal/publish CHECK pair)" "SQLSTATE=23514 reported=$TERM_NAME (the two overlap by construction — see the note above)"
else
  bad "L2-8b 🔴 a published row CANNOT be marked withdrawn without being unpublished" "SQLSTATE=[$TERM_STATE] constraint=[$TERM_NAME]"
fi
TERM_OK=$(Q "update legal_submitted_listing set submission_status='withdrawn', is_published=false, published_at=null, withdrawn_at=now() where slug='term-row' returning submission_status")
check "L2-8c withdrawing AND unpublishing in one statement is accepted (which is what the route does)" "$TERM_OK" "withdrawn"

GOOD=$(Q "insert into legal_submitted_listing (business_name, city, region_state, submitted_by_email, slug)
          values ('Acme Mediation','Portland','OR','a@b.co','acme-mediation-portland-or-aaaaaa')
          returning is_published || '/' || submission_status")
check "L2-9 a minimal valid row INSERTs, defaults to is_published=false, and is pending_verification (an omitted column publishes NOTHING)" "$GOOD" "false/pending_verification"

# ── PARTIAL UNIQUE INDEXES ──
SID=$(Q "select submission_id from legal_submitted_listing limit 1")
Q "update legal_submitted_listing set verify_token_sha256='dig1', verify_token_expires_at=now()+interval '1 day' where submission_id='$SID'" >/dev/null
DUP=$(SQLSTATE_OF "insert into legal_submitted_listing (business_name, city, region_state, submitted_by_email, slug, verify_token_sha256, verify_token_expires_at) values ('B','P','OR','b@c.co','s2','dig1', now()+interval '1 day')")
check "L2-10 the verify-token unique index refuses a duplicate LIVE digest" "$DUP" "23505"
NULLS=$(Q "insert into legal_submitted_listing (business_name, city, region_state, submitted_by_email, slug) values ('C','P','OR','c@d.co','s3'),('D','P','OR','d@e.co','s4') returning 1" | wc -l)
check "L2-11 the index is PARTIAL — two rows with a NULL (consumed) token coexist" "$NULLS" "2"
SLUGDUP=$(SQLSTATE_OF "insert into legal_submitted_listing (business_name, city, region_state, submitted_by_email, slug) values ('E','P','OR','e@f.co','s3')")
check "L2-12 (site, slug) is unique" "$SLUGDUP" "23505"
SITEOK=$(Q "insert into legal_submitted_listing (site, business_name, city, region_state, submitted_by_email, slug) values ('dinla-e2e','E','P','OR','e@f.co','s3') returning 1")
check "L2-13 🔴 the SAME slug under a DIFFERENT site is allowed — that is what isolates an E2E row from a production one" "$SITEOK" "1"

# ── THE FK ──
FK=$(SQLSTATE_OF "insert into legal_submitted_listing_history (submission_id, actor, action) values (gen_random_uuid(),'x','y')")
check "L2-14 the history FK refuses an orphan audit row" "$FK" "23503"

# ── 🔴 PUBLISH-ON-VERIFY IN ONE STATEMENT, AND THE DOUBLE-CLICK REPLAY ──
Q "update legal_submitted_listing set verify_token_sha256='live', verify_token_expires_at=now()+interval '1 day', submission_status='pending_verification' where slug='s4'" >/dev/null
CONSUME="update legal_submitted_listing set submission_status='verified', verified_at=now(), is_published=true, published_at=now(), verify_token_sha256=null, verify_token_expires_at=null where verify_token_sha256='live' and verify_token_expires_at > now() and submission_status='pending_verification' returning slug"
FIRST=$(Q "$CONSUME")
check "L2-15 consume→verified→published lands in ONE statement (the CHECKs are never transiently false)" "$FIRST" "s4"
SECOND=$(Q "$CONSUME" | grep -c . || true)
check "L2-16 🔴 a SECOND consume of the same token matches ZERO ROWS — the replay is impossible, not merely detected" "$SECOND" "0"
STATE_AFTER=$(Q "select submission_status || '/' || is_published from legal_submitted_listing where slug='s4'")
check "L2-17 the replay left the row's lifecycle untouched" "$STATE_AFTER" "verified/true"

# ── THE FINDER, against a fabricated roster-shaped fixture ──
#
# The real normalisers, copied verbatim from the production database this session
# (pg_get_functiondef), so the finder under test is the SAME SQL calling the SAME functions —
# not a TypeScript re-implementation free to drift from what dedup_match uses.
Q "create or replace function public.f_unaccent(text) returns text language sql immutable parallel safe as \$\$ select public.unaccent('public.unaccent', \$1) \$\$;
   create or replace function public.norm_domain(p text) returns text language sql immutable parallel safe as \$\$
     select nullif(regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(p,'')), '^\s*[a-z]+://', '', 'i'), '^[^/@]*@', ''), '[:/?#].*\$', ''), '^www\.', ''), '') \$\$;
   create or replace function public.norm_name(p text) returns text language sql immutable parallel safe as \$\$
     select nullif(regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(f_unaccent(regexp_replace(regexp_replace(coalesce(p,''), E'[''’‘ʼ\`´]', '', 'g'), '\s*&\s*', ' and ', 'g'))), '^the\s+', '', 'i'), '\s+(llc|l\.l\.c|inc|ltd|corp|co|plc|llp|pc|pllc|incorporated|corporation|company|limited)\.?\s*\$', '', 'gi'), '[^a-z0-9]+', ' ', 'g'), '^\s+|\s+\$', '', 'g'), '') \$\$;
   create or replace function public.norm_phone(p text) returns text language sql immutable parallel safe as \$\$
     with d as (select regexp_replace(coalesce(p,''), '\D', '', 'g') as digits)
     select case when length(digits) < 10 then null when length(digits) = 10 then '+1'||digits
       when length(digits) = 11 and left(digits,1) = '1' then '+1'||right(digits,10) else null end from d \$\$;
   create or replace function public.street_number(p text) returns text language sql immutable parallel safe as \$\$
     select nullif(substring(coalesce(p,'') from '^\s*(\d+)'), '') \$\$;" >/dev/null

Q "create table legal_listings (id uuid primary key default gen_random_uuid(), slug text, name text, business_name text,
     phone text, website text, address text, postal_code text, country text, is_published boolean, deserve_reason text);
   insert into legal_listings (slug, name, phone, website, address, postal_code, country, is_published, deserve_reason) values
     ('served-firm','Harbor Legal Partners','(503) 555-0100','https://www.harborlegal.example','88 Harbor St','97201','US',true,null),
     ('held-allow','Cascade Law Office','503-555-0200',null,'12 Pine Ave','97202','US',false,'person_seeded_licensing_roster'),
     ('held-deny','Rose City Counsel','5035550300',null,'9 Rose Ln','97203','US',false,'RESTRICTED_SOURCE_TERMS'),
     ('ca-row','Vancouver Legal','604-555-0400',null,'1 Granville','V6B1A1','CA',true,null);" >/dev/null

if psql -v ON_ERROR_STOP=1 -q -f migrations/2026-09-18_legal_lane_finder.sql >"$RUN/fn.log" 2>&1; then
  ok "L2-18 the finder migration applies cleanly, unmodified"
else
  bad "L2-18 the finder migration applies cleanly, unmodified" "$(tail -3 "$RUN/fn.log" | tr '\n' ' ')"
fi

VOL=$(Q "select provolatile::text || (case when prosecdef then 't' else 'f' end) from pg_proc where proname='legal_lane_find_candidates'")
check "L2-19 🔴 the INSTALLED finder is STABLE and SECURITY INVOKER (Postgres itself then refuses any write inside it)" "$VOL" "sf"

# 🔴 THE OMISSION IS THE RULING: a HELD row must be RETRIEVED, or the lane mints a duplicate
# identity for someone we already hold.
HELD=$(Q "select cand_slug from legal_lane_find_candidates('Cascade Law Office','503-555-0200',null,null,null)")
check "L2-20 🔴 the finder RETRIEVES A HELD ROW (no is_published filter — that omission IS the ruling)" "$HELD" "held-allow"
SERVED=$(Q "select cand_slug from legal_lane_find_candidates('Harbor Legal Partners',null,'harborlegal.example',null,null)")
check "L2-21 the domain branch matches through www. and the scheme" "$SERVED" "served-firm"
CA=$(Q "select count(*) from legal_lane_find_candidates('Vancouver Legal','604-555-0400',null,null,null)")
check "L2-22 🔴 a CA row is NEVER returned — the finder is country='US' only (freelawyeradvice owns CA)" "$CA" "0"
ZIP=$(Q "select cand_slug from legal_lane_find_candidates('Harbour Legal Partners',null,null,null,'97201')")
check "L2-23 the postal branch retrieves on zip ∩ name similarity" "$ZIP" "served-firm"
ZIPNO=$(Q "select count(*) from legal_lane_find_candidates('Totally Unrelated Widgets',null,null,null,'97201')")
check "L2-24 the postal branch does NOT retrieve on a zip alone — the >= 0.3 similarity floor is explicit, never a GUC" "$ZIPNO" "0"
NONE=$(Q "select count(*) from legal_lane_find_candidates('Nobody At All',null,null,null,null)")
check "L2-25 a submission with no retrievable signal returns zero candidates (→ no_match → the only outcome that writes)" "$NONE" "0"

# 🔴 THE FINDER CANNOT WRITE. Not "does not" — cannot: STABLE is enforced by the engine.
# The engine's own words are `ERROR:  0A000: UPDATE is not allowed in a non-volatile function`,
# raised at function startup. The first version of this grepped for "read-only" / "cannot
# execute UPDATE" — neither of which Postgres says here — so it reported "no refusal observed"
# while the refusal was happening. Matching the SQLSTATE as well as the text means a reworded
# message cannot turn this into a silent false negative.
WROTE=$(psql -q -v ON_ERROR_STOP=0 -v VERBOSITY=verbose -tAc \
  "create or replace function lane_write_probe() returns void language sql stable as \$\$ update legal_listings set is_published=false \$\$; select lane_write_probe()" 2>&1 \
  | grep -cE '0A000|not allowed in a non-volatile function' || true)
if [ "$WROTE" -ge 1 ]; then
  ok "L2-26 🔴 PS-L8 lock 1 PROVEN ON THE ENGINE — a write inside a STABLE function is REFUSED at runtime" "ERROR 0A000: UPDATE is not allowed in a non-volatile function"
else
  bad "L2-26 🔴 PS-L8 lock 1 PROVEN ON THE ENGINE — a write inside a STABLE function is REFUSED at runtime" "no refusal observed"
fi

FNGRANT=$(Q "select count(*) from information_schema.role_routine_grants where routine_name='legal_lane_find_candidates' and grantee in ('anon','authenticated','PUBLIC')")
check "L2-27 the finder is EXECUTE-revoked from anon/authenticated/PUBLIC" "$FNGRANT" "0"

echo ""
echo "LANE-LIFECYCLE: $PASS pass, $FAIL fail"
[ "$FAIL" -eq 0 ] || exit 1
