import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { generateToken } from "@/lib/auth";
import { sendClaimEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { slug, email, name } = await request.json();

    if (!slug || !email || !name) {
      return NextResponse.json(
        { success: false, error: "missing_fields", userMessage: "Please fill in all fields." },
        { status: 400 }
      );
    }

    const { data: listing, error } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("id, claimed")
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

    const token = generateToken();

    // Send the verification email FIRST — if it fails we don't leave an
    // orphan owner_auth_token / owner_email on the row.
    try {
      await sendClaimEmail(email, slug, token);
    } catch (emailErr) {
      console.error("[claim] email send failed:", emailErr instanceof Error ? emailErr.message : emailErr);
      return NextResponse.json(
        {
          success: false,
          error: "email_send_failed",
          userMessage:
            "We're having trouble sending the verification email right now. Please try again in a few minutes.",
        },
        { status: 503 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .update({ owner_auth_token: token, owner_email: email })
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
