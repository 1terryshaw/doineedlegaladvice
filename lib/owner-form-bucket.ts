// Schema-bucket awareness for OwnerEditForm v1.
//
// Verticals fall into two buckets based on column naming:
//   B1: business_name + province         (e.g. ~unconfirmed; spec called this out
//                                         but no shipped repo is yet known to be B1)
//   B2: name          + province_state   (e.g. plumber, webdesigner — confirmed)
//
// The form ALWAYS uses canonical wire-format keys ("name", "province_state"),
// regardless of bucket. The edit page reads the actual DB column via
// BUCKET.nameColumn / BUCKET.provinceColumn, and the API update route writes
// back to the actual DB column via the same mapping. The form layer never
// references the DB column names directly.
//
// Stamping checklist (per repo):
//   1. Run `\d <vertical>_listings` in psql (or query information_schema.columns)
//      to confirm whether the table has `name` (B2) or `business_name` (B1).
//   2. Set BUCKET below to BUCKET_B1 or BUCKET_B2 accordingly.
//   3. Default is B2 because both Phase 1 verticals are B2.

export type SchemaBucket = "B1" | "B2";

export interface BucketColumns {
  nameColumn: "name" | "business_name";
  provinceColumn: "province" | "province_state";
}

export const BUCKET_B1: BucketColumns = {
  nameColumn: "business_name",
  provinceColumn: "province",
};

export const BUCKET_B2: BucketColumns = {
  nameColumn: "name",
  provinceColumn: "province_state",
};

// Per-repo: change to BUCKET_B1 if the *_listings table uses business_name.
export const BUCKET: BucketColumns = BUCKET_B2;


export const BUCKET_B3 = {
  id: "B3",
  description: "name + state_province canonical (legal umbrella)",
  nameField: "name",
  businessNameField: "business_name",
  regionField: "state_province",
} as const;
