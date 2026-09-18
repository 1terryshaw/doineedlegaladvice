import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { LANE_ACCENT, LANE_ROBOTS } from "@/lib/lane-gate";
import { LANE_CSRF_COOKIE, LANE_SESSION_COOKIE, loadLaneSession } from "@/lib/lane-session";
import { laneRowBySlug, laneSessionByDigest, OWNER_EDITABLE_FIELDS } from "@/lib/lane-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your listing", robots: LANE_ROBOTS };

/**
 * THE LANE OWNER'S SURFACE (spec §4, §7.3).
 *
 * 🔴 WITHOUT A SESSION IT NAMES NOTHING. Not "shows a login form for <business>" — names
 * nothing at all. A page that says which business lives at a slug is an enumeration oracle for
 * a table whose rows are `noindex` precisely so they are not enumerable.
 *
 * The CSRF secret is read from the httpOnly cookie SERVER-SIDE and embedded as a hidden field,
 * so the page never needs JavaScript to obtain it and the browser never exposes it to script.
 * That is what makes the double-submit's two channels genuinely independent.
 */
export default async function OwnerSubmittedPage({
  params, searchParams,
}: {
  params: { slug: string };
  searchParams: { error?: string; saved?: string; verified?: string };
}) {
  const jar = cookies();
  const lookup = await loadLaneSession(jar.get(LANE_SESSION_COOKIE)?.value, {
    bySecretDigest: laneSessionByDigest,
  });

  if (!lookup.ok || lookup.slug !== params.slug) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px" }}>
        <h1 style={{ color: LANE_ACCENT, fontSize: 24, fontWeight: 700 }}>Sign in required</h1>
        <p style={{ marginTop: 12, lineHeight: 1.6 }}>
          This page is only available from the link we emailed when the listing was confirmed.
          Open that email on this device to manage the listing.
        </p>
        {/* Deliberately names no business and confirms no slug. */}
      </div>
    );
  }

  const row = await laneRowBySlug(params.slug);
  if (!row) notFound();

  const csrf = jar.get(LANE_CSRF_COOKIE)?.value ?? "";
  const field = (name: string, label: string, value: string | null, type = "text") => (
    <label key={name} style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, marginTop: 4 }}
      />
    </label>
  );

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 64px" }}>
      <h1 style={{ color: LANE_ACCENT, fontSize: 26, fontWeight: 700 }}>{row.business_name}</h1>
      <p style={{ color: "#64748b", marginTop: 4 }}>
        {row.is_published ? (
          <>Live at <a href={`/listed/${row.slug}`} style={{ color: LANE_ACCENT }}>/listed/{row.slug}</a></>
        ) : (
          <>This listing is not currently shown on the site.</>
        )}
      </p>
      {searchParams.saved && <p style={{ color: "#166534" }}>Saved.</p>}
      {searchParams.verified && <p style={{ color: "#166534" }}>Your email is confirmed and the listing is live.</p>}
      {searchParams.error && <p style={{ color: "#b91c1c" }}>We couldn&apos;t apply that change ({searchParams.error}).</p>}

      <form method="post" action="/api/owner/submitted/update" style={{ marginTop: 24 }}>
        {/*
          The CSRF secret, embedded server-side from the httpOnly cookie. The handler reads it
          from the BODY and compares its DIGEST to the stored digest — never from the cookie it
          is checked against (PS-L7).
        */}
        <input type="hidden" name="csrf" value={csrf} />
        {/*
          🔴 THE BUSINESS NAME IS SHOWN, NOT EDITABLE. It is the identity a mailbox was proven
          for. A forged `business_name` in the body is dropped by the allow-list on both sides.
        */}
        {field("contact_name", "Contact name", row.contact_name)}
        {field("address_line", "Address", row.address_line)}
        {field("phone", "Phone", row.phone, "tel")}
        {field("website", "Website", row.website, "url")}
        {field("public_email", "Public email", row.public_email, "email")}
        <label style={{ display: "block", marginBottom: 14 }}>
          <span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>Description</span>
          <textarea
            name="description"
            defaultValue={row.description ?? ""}
            rows={4}
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, marginTop: 4 }}
          />
        </label>
        <button
          type="submit"
          style={{ background: LANE_ACCENT, color: "#fff", border: 0, borderRadius: 6, padding: "10px 18px", fontWeight: 600 }}
        >
          Save changes
        </button>
      </form>

      <form method="post" action="/api/owner/submitted/update" style={{ marginTop: 32, borderTop: "1px solid #e2e8f0", paddingTop: 20 }}>
        <input type="hidden" name="csrf" value={csrf} />
        <input type="hidden" name="action" value="withdraw" />
        <p style={{ fontSize: 14, color: "#64748b", marginBottom: 10 }}>
          Removing takes the page down immediately and ends this session. You can submit again
          at any time.
        </p>
        <button
          type="submit"
          style={{ background: "#fff", color: "#b91c1c", border: "1px solid #b91c1c", borderRadius: 6, padding: "10px 18px", fontWeight: 600 }}
        >
          Remove this listing
        </button>
      </form>
      <p style={{ marginTop: 24, fontSize: 12, color: "#94a3b8" }}>
        Editable fields: {OWNER_EDITABLE_FIELDS.join(", ")}.
      </p>
    </div>
  );
}
