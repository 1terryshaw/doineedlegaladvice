// owner-auth-hardening-and-edit-log-v1 (B, 2026-09-26) — owner ACTIVATION events in owner_edit_log.
//
// ACTIVATED (CEO definition) = the owner approved, edited, or made >= 1 genuine listing change.
// Login alone never counts, so nothing here is called from the login/auth/claim routes.
//
// One row per changed field (profile edits) or per action (photos, GBP connect, place confirm):
//   table_name, listing_id, slug, field (column name or action class), actor='owner',
//   event_kind='owner_mutation', action_class, genuine_mutation, created_at.
// NEVER stored: field values (before/after stay NULL), tokens, email addresses, request bodies.
//
// NON-BLOCKING: every function catches everything and is bounded by a 1.5 s timeout. A failed or
// slow log write can never fail, delay beyond the bound, or roll back an owner save. (The location
// before/after audit rows written by lib/owner-location-edit.ts are a separate, deliberately
// fail-closed audit contract — claimant-edit-ux R2/R3 — and are unchanged.)
import { cookies } from "next/headers";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { getAuthFromCookies } from "@/lib/auth";

export type OwnerMutationClass =
  | "profile_edit" | "profile_proposal" | "photo_upload" | "photo_edit" | "photo_delete" | "hero_image"
  | "gbp_connect" | "place_confirm" | "place_reject" | "place_edit" | "place_find" | "content_publish";

// Bookkeeping or derived columns: written by the route itself, never an owner change on their own.
const NOT_OWNER_FIELDS = new Set([
  "updated_at", "owner_last_action_at", "geo_stale", "geo_precision_m", "city_slug", "region_slug",
]);
const TIMEOUT_MS = 1500;

async function bounded<T>(p: PromiseLike<T>): Promise<T | null> {
  return Promise.race([Promise.resolve(p), new Promise<null>((r) => setTimeout(() => r(null), TIMEOUT_MS))]);
}

// Order-insensitive, null/"" -insensitive comparison key (Postgres jsonb re-orders object keys).
function canon(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (typeof v === "object") {
    return "{" + Object.keys(v as Record<string, unknown>).sort()
      .map((k) => JSON.stringify(k) + ":" + canon((v as Record<string, unknown>)[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

export type OwnerEditSnapshot = { listingId: string; fields: string[]; changed: string[] | null };

/**
 * Call BEFORE the write. Reads only the columns about to be written (from the listing row, or from the
 * side table the route writes owner fields to, e.g. { table: "hospitality_owner_marketing",
 * idColumn: "canonical_entity_id" }). Never throws.
 */
export async function snapshotOwnerEdit(
  listingId: unknown,
  updates: Record<string, unknown>,
  source: { table?: string; idColumn?: string } = {},
): Promise<OwnerEditSnapshot> {
  const fields = Object.keys(updates).filter((k) => !NOT_OWNER_FIELDS.has(k) && /^[a-z_][a-z0-9_]*$/.test(k));
  const snap: OwnerEditSnapshot = { listingId: String(listingId ?? ""), fields, changed: null };
  if (!fields.length) return { ...snap, changed: [] };
  try {
    const res = await bounded(supabaseAdmin.from(source.table ?? LISTINGS_TABLE).select(fields.join(","))
      .eq(source.idColumn ?? "id", listingId as string).maybeSingle());
    const row = (res as { data?: Record<string, unknown> | null; error?: unknown } | null);
    if (!row || row.error) return snap;                          // unknown: genuine_mutation stays NULL
    if (!row.data) return source.table ? { ...snap, changed: fields.filter((f) => canon(updates[f]) !== "") } : snap; // first side-table row
    return { ...snap, changed: fields.filter((f) => canon(row.data![f]) !== canon(updates[f])) };
  } catch {
    return snap;
  }
}

async function insertRows(rows: Record<string, unknown>[]): Promise<void> {
  try {
    const res = await bounded(supabaseAdmin.from("owner_edit_log").insert(rows));
    const err = (res as { error?: { code?: string } } | null)?.error;
    if (!res) console.error("[owner-edit-events] owner_edit_log insert timed out (save NOT affected)");
    else if (err) console.error("[owner-edit-events] owner_edit_log insert failed (save NOT affected)", err.code ?? "");
  } catch {
    console.error("[owner-edit-events] owner_edit_log insert threw (save NOT affected)");
  }
}

/** Owner-submitted change proposals (reviewed before they reach the listing): each is a genuine owner edit. */
export function ownerProposalSnapshot(listingId: unknown, fields: string[]): OwnerEditSnapshot {
  return { listingId: String(listingId ?? ""), fields, changed: fields };
}

/** Call AFTER a successful write with the snapshot taken before it. Never throws. */
export async function recordOwnerEdit(
  snap: OwnerEditSnapshot,
  slug: unknown,
  action: "profile_edit" | "profile_proposal" = "profile_edit",
): Promise<void> {
  if (!snap.listingId) return;
  const genuine = snap.changed === null ? null : snap.changed.length > 0;
  const names = genuine ? snap.changed! : genuine === false ? ["(no_change)"] : (snap.fields.length ? snap.fields : ["(unknown)"]);
  await insertRows(names.slice(0, 40).map((field) => ({
    table_name: LISTINGS_TABLE, listing_id: snap.listingId, slug: String(slug ?? "").slice(0, 200), field: field.slice(0, 60),
    actor: "owner", event_kind: "owner_mutation", action_class: action, genuine_mutation: genuine,
  })));
}

/** One action event for the listing behind the caller's (already authorised) owner cookie. Never throws. */
export async function recordOwnerAction(action: OwnerMutationClass, genuine: boolean | null = true): Promise<void> {
  try {
    const auth = getAuthFromCookies(await cookies());
    if (!auth) return;
    const res = await bounded(supabaseAdmin.from(LISTINGS_TABLE).select("id").eq("slug", auth.slug).eq("owner_auth_token", auth.token).maybeSingle());
    const id = (res as { data?: { id?: unknown } | null } | null)?.data?.id;
    if (id === undefined || id === null) return;
    await insertRows([{
      table_name: LISTINGS_TABLE, listing_id: String(id), slug: auth.slug.slice(0, 200), field: action,
      actor: "owner", event_kind: "owner_mutation", action_class: action, genuine_mutation: genuine,
    }]);
  } catch { /* non-blocking */ }
}

type Handler<A extends unknown[]> = (...args: A) => Promise<Response>;

/** True when the caller's listing currently has a non-empty `column` (null = could not be read). */
export async function ownerListingHas(column: string): Promise<boolean | null> {
  try {
    if (!/^[a-z_][a-z0-9_]*$/.test(column)) return null;
    const auth = getAuthFromCookies(await cookies());
    if (!auth) return null;
    const res = await bounded(supabaseAdmin.from(LISTINGS_TABLE).select(column).eq("slug", auth.slug).eq("owner_auth_token", auth.token).maybeSingle());
    const row = (res as { data?: Record<string, unknown> | null; error?: unknown } | null);
    if (!row || row.error || !row.data) return null;
    return canon(row.data[column]) !== "";
  } catch { return null; }
}

/**
 * Wrap an owner mutation route handler: after a 2xx response (the handler has authorised the owner
 * and written the change) record one activation event. `classify` may read the body (a clone, parsed
 * as JSON whatever the content-type; the handler still gets the original) to name the action or mark a
 * non-change (e.g. a rejection). `precheck` runs BEFORE the handler and decides genuineness for
 * actions that can be no-ops (e.g. clearing a hero that was never set).
 */
export function withOwnerMutationLog<A extends unknown[]>(
  handler: Handler<A>,
  action: OwnerMutationClass,
  classify?: (body: Record<string, unknown> | null) => { action: OwnerMutationClass; genuine: boolean },
  precheck?: () => Promise<boolean | null>,
): Handler<A> {
  return async (...args: A): Promise<Response> => {
    let body: Record<string, unknown> | null = null;
    if (classify) {
      try {
        const txt = await (args[0] as Request).clone().text();
        const parsed = txt ? JSON.parse(txt) : null;
        body = parsed && typeof parsed === "object" ? parsed : null;
      } catch { body = null; }
    }
    let pre: boolean | null = true;
    if (precheck) {
      try { pre = await precheck(); } catch { pre = null; }
    }
    const res = await handler(...args);
    if (res.status >= 200 && res.status < 300) {
      try {
        const c = classify ? classify(body) : { action, genuine: true };
        await recordOwnerAction(c.action, c.genuine && pre === true ? true : c.genuine === false || pre === false ? false : null);
      } catch { /* non-blocking */ }
    }
    return res;
  };
}
