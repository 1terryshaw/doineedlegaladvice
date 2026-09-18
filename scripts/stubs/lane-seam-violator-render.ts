/**
 * RED CONTROL for PS-L2. NOT SHIPPED, NOT IMPORTED BY ANYTHING.
 *
 * Proves BOTH halves of the split ban discriminate: the closure ban on the directory's
 * components (TierBadge) and the direct-import ban on its model modules (lib/supabase.ts).
 */
import TierBadge from "@/components/TierBadge";
import { supabaseAdmin } from "@/lib/supabase";

export const planted = { TierBadge, supabaseAdmin };
