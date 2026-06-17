import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { UK_TABLE } from "@/lib/uk-solicitors";

export const dynamic = "force-dynamic";

// Dedicated UK health probe — kept separate from /api/health (the CA acct_listings
// probe) so the two markets are independently observable.
export async function GET() {
  const checks: Record<string, string> = {};

  let total = 0;
  let published = 0;
  try {
    const totalRes = await supabaseAdmin.from(UK_TABLE).select("*", { count: "exact", head: true });
    if (totalRes.error) {
      checks.uk_solicitors = `error: ${totalRes.error.message}`;
    } else {
      total = totalRes.count || 0;
      const pubRes = await supabaseAdmin
        .from(UK_TABLE)
        .select("*", { count: "exact", head: true })
        .eq("is_published", true);
      published = pubRes.count || 0;
      checks.uk_solicitors = total > 0 ? "connected" : "EMPTY";
    }
  } catch (e) {
    checks.uk_accountants = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }

  // Stat views back the geo hubs.
  try {
    const { error } = await supabaseAdmin
      .from("uk_solicitors_county_stats")
      .select("county", { count: "exact", head: true });
    checks.stat_views = error ? `error: ${error.message}` : "ok";
  } catch (e) {
    checks.stat_views = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }

  const requiredEnvVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_BASE_URL",
  ];
  const optionalEnvVars = ["RESEND_API_KEY"];
  for (const key of requiredEnvVars) checks[key] = process.env[key] ? "set" : "MISSING";
  for (const key of optionalEnvVars) checks[key] = process.env[key] ? "set" : "not set";

  const allRequiredSet = requiredEnvVars.every((k) => process.env[k]);
  const supabaseOk = checks.uk_solicitors === "connected";

  return NextResponse.json({
    status: allRequiredSet && supabaseOk ? "healthy" : "degraded",
    vertical: "solicitor_uk",
    listings_table: UK_TABLE,
    total,
    published,
    checks,
    timestamp: new Date().toISOString(),
  });
}
