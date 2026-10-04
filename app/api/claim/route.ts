import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { generateToken } from "@/lib/auth";
import { isOwnerTokenExpired } from "@/lib/owner-authorization";
import { sendClaimEmail } from "@/lib/email";
import { normalizeClaimSrc } from "@/lib/claim-attribution";
import { checkClaimStartRate } from "@/lib/claim-start-ratelimit";
import { logOwnerAuthEvent } from "@/lib/owner-events";

export const dynamic = "force-dynamic";

/** Best-effort operator alert (same shape as owner-login). Never throws, never logs the raw email. */
async function alertLimiterFailure(error: string) {
  try {
    const { error: insErr } = await supabaseAdmin.from("sentinel_alerts").insert({
      severity: "high",
      module: "claim-start",
      repo: "doineedlegaladvice",
      title: `Claim-start rate limiter error on ${LISTINGS_TABLE}`,
      details: { table: LISTINGS_TABLE, error, impact: "limiter failed OPEN — claim starts proceed unthrottled until fixed" },
      status: "open",
    });
    if (insErr) console.error(`[claim] sentinel_alerts insert failed: ${insErr.message}`);
  } catch (e) {
    console.error(`[claim] sentinel_alerts insert threw: ${e instanceof Error ? e.message : e}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { slug, email, name, src, lid } = await request.json();

    if (!slug || !email || !name) {
      return NextResponse.json(
        { success: false, error: "missing_fields", userMessage: "Please fill in all fields." },
        { status: 400 }
      );
    }

    const { data: listing, error } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("id, claimed, name, owner_email, owner_auth_token, owner_auth_token_expires_at")
      .eq("slug", slug)
      .single();

    if (error || !listing) {
      return NextResponse.json(
        { success: false, error: "not_found", userMessage: "We couldn't find that listing." },
        { status: 404 }
      );
    }

    if (listing.claimed) {
      return NextResponse.json(
        { success: false, error: "already_claimed", userMessage: "This listing has already been claimed." },
        { status: 400 }
      );
    }

    // TDL #510 P2.2: claim ownership verification — block free-email-domain claims on
    // corporate/professional-named listings + 72h same-listing cooling-off. Allowlist first;
    // fail-open on RPC error (don't block legit owners).
    try {
      const { data: cv } = await supabaseAdmin.rpc("abuse_claim_verdict", {
        p_email: email,
        p_listing_id: String(listing.id),
        p_listing_name: listing.name,
      });
      const verdict = cv as { blocked?: boolean; reason?: string } | null;
      if (verdict && verdict.blocked) {
        const userMessage =
          verdict.reason === "free_email_vs_corporate"
            ? "This listing looks like a registered business. To claim it, use an email at the business's own domain — or contact support to verify by phone."
            : verdict.reason === "cooling_off_72h"
              ? "You recently contacted this listing. For security, claiming is paused for 72 hours after an inquiry. Please try again later, or contact support."
              : "This claim can't be completed automatically. Please contact support.";
        return NextResponse.json(
          { success: false, error: "claim_blocked", reason: verdict.reason, userMessage },
          { status: 403 }
        );
      }
    } catch (e) {
      console.error("[abuse] claim verdict failed (fail-open):", e instanceof Error ? e.message : e);
    }

    // empire-vitals-fix-v1 (Part A) — claim-START throttle (empire-vitals-recon-v1 §3: scripted
    // enumeration put third-party addresses into this form; each new start re-pointed owner_email
    // and the token at a new stranger). Three gates, all answered with the byte-identical generic
    // success below — nothing tells the caller which gate fired, or whether one did:
    //   1. PER LISTING: a verify token minted by this route is still pending (unexpired; claimed
    //      rows never reach here) => send NOTHING and write NOTHING. The pending owner_email and
    //      token survive. A NULL expiry is a legacy/login mint, never this route's (it always
    //      writes +24h), so it does not lock the listing.
    //   2. PER IP: 5 claim starts per hour (gate-1 starts count too).
    //   3. PER RECIPIENT: 3 claim-verify sends per rolling 24h, estate-wide (email hash).
    // Limiter errors FAIL OPEN (the send proceeds) but always raise a sentinel alert. Gate 1 is
    // row data, not the limiter, so it holds even while the limiter is down.
    const pendingToken =
      !!listing.owner_auth_token &&
      !!listing.owner_auth_token_expires_at &&
      !isOwnerTokenExpired(listing.owner_auth_token_expires_at);
    const rate = await checkClaimStartRate(email, request, !pendingToken);
    if (rate.error) {
      console.error(JSON.stringify({ event: "claim_start_ratelimit_error", err: rate.error }));
      await alertLimiterFailure(rate.error);
    }
    const throttled = pendingToken ? "pending_token" : rate.verdict !== "ok" ? rate.verdict : null;
    if (throttled) {
      console.log(JSON.stringify({ event: "claim_start_throttled", slug, reason: throttled }));
      await logOwnerAuthEvent("claim_start_throttled", { slug, email, detail: throttled });
      return NextResponse.json({ success: true });
    }

    // A retry must not kill the link we already emailed. The claim capability lives in ONE
    // column on the LISTING row (owner_auth_token) — there is no per-email token table — so
    // an existing token can only be re-sent to the address that minted it. Same listing +
    // same email + still-live token => re-send that exact link and write nothing, so every
    // earlier email stays valid. Anything else (first claim, a different email, an expired
    // token) mints fresh and necessarily supersedes the old link, which is correct: a
    // capability must not survive being re-pointed at a different claimant.
    // (Since empire-vitals-fix-v1, gate 1 above already returns for a live +24h claim token;
    // reuse here now only fires for a NULL-expiry legacy token.)
    const submittedEmail = String(email).trim().toLowerCase();
    const rowEmail = String(listing.owner_email || "").trim().toLowerCase();
    const reuseToken =
      !!listing.owner_auth_token &&
      rowEmail !== "" &&
      rowEmail === submittedEmail &&
      !isOwnerTokenExpired(listing.owner_auth_token_expires_at);
    const token = reuseToken ? String(listing.owner_auth_token) : generateToken();

    // Send the verification email FIRST — if it fails we don't leave an
    // orphan owner_auth_token / owner_email on the row.
    const emailRedacted = String(email).replace(/(.{2}).+(@.+)/, "$1***$2");
    const emailFailed = NextResponse.json(
      {
        success: false,
        error: "email_send_failed",
        userMessage:
          "We're having trouble sending the verification email right now. Please try again in a few minutes.",
      },
      { status: 503 }
    );
    try {
      const result = await sendClaimEmail(email, slug, token);
      if (!result.ok) {
        console.error(
          JSON.stringify({ event: "claim_send_error", email_redacted: emailRedacted, slug, err: result.error })
        );
        return emailFailed;
      }
      console.log(
        JSON.stringify({ event: "claim_send_ok", email_redacted: emailRedacted, slug, resend_id: result.id, token_reused: reuseToken })
      );
    } catch (emailErr) {
      console.error(
        JSON.stringify({ event: "claim_send_error", email_redacted: emailRedacted, slug, err: String(emailErr) })
      );
      return emailFailed;
    }

    // Only a freshly minted token needs writing; a re-send already matches the row.
    if (!reuseToken) {
      const { error: updateError } = await supabaseAdmin
        .from(LISTINGS_TABLE)
        .update({ owner_auth_token: token, owner_auth_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), owner_email: email })
        .eq("id", listing.id);

      if (updateError) {
        console.error("[claim] db write failed after email sent:", updateError.message);
        return NextResponse.json(
          {
            success: false,
            error: "db_write_failed",
            userMessage:
              "We sent your verification email but hit a snag finishing the claim. Please try again — if it persists, contact support.",
          },
          { status: 500 }
        );
      }
    }
    // claim-src-attribution-v1 (2026-09-10): ADD-fresh attribution. Normalized via the
    // shared allowlist; a row is written on EVERY claim (absent src -> 'unknown').
    // Never fail the claim over analytics — the claim itself already succeeded.
    {
      const cleanLid = typeof lid === "string" ? lid.replace(/^i-/, "") : null;
      const { error: attrErr } = await supabaseAdmin
        .from("claim_attribution")
        .insert({ lead_id: cleanLid || null, vertical: "doineedlegaladvice", listing_id: String(listing.id), src: normalizeClaimSrc(src), slug });
      if (attrErr) {
        console.error(`[claim] claim_attribution insert failed for ${slug} (claim itself SUCCEEDED): ${attrErr.message}`);
      }
    }


    return NextResponse.json({ success: true });
  } catch (unexpectedErr) {
    console.error("[claim] unexpected error:", unexpectedErr instanceof Error ? unexpectedErr.message : unexpectedErr);
    return NextResponse.json(
      {
        success: false,
        error: "unexpected",
        userMessage: "Something went wrong on our end. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
