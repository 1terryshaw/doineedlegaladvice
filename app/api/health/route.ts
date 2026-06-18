import { NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { getVerticalIdentity } from "@/lib/cost-models";

export const dynamic = "force-dynamic";

export async function GET() {
  let supabaseOk = false;
  let listingCount = 0;
  let costModelsOk = false;
  let costModelCount = 0;
  let verticalSlug = "";

  try {
    const { count, error } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("*", { count: "exact", head: true });
    if (!error) {
      supabaseOk = true;
      listingCount = count || 0;
    }
  } catch {
    // supabase check failed
  }

  try {
    const { vertical_slug } = await getVerticalIdentity();
    verticalSlug = vertical_slug;
    const { count, error } = await supabaseAdmin
      .from("cost_models")
      .select("*", { count: "exact", head: true })
      .eq("vertical", vertical_slug);
    if (!error && (count || 0) > 0) {
      costModelsOk = true;
      costModelCount = count || 0;
    }
  } catch {
    // cost_models check failed
  }

  const status = supabaseOk && costModelsOk ? "healthy" : "degraded";

  return NextResponse.json({
    status,
    checks: { supabase: supabaseOk, cost_models: costModelsOk },
    vertical: verticalSlug || LISTINGS_TABLE.replace(/_listings$/, ""),
    listingCount,
    costModelCount,
    timestamp: new Date().toISOString(),
  });
}
