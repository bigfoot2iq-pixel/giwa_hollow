import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getRaffleStatus } from "@/lib/utils/raffles";
import { getOnChainRaffleState } from "@/lib/utils/chain";
import { syncRaffleEntriesFromChain } from "@/lib/raffles/sync-entries";
import { CACHE } from "@/lib/utils/cache";

export const maxDuration = 15;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const supabase = await createServiceClient();

    // Check if id is a UUID or a slug
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(id);

    let query = supabase
      .from("litvm_raffle_raffles")
      .select("*");

    if (isUuid) {
      query = query.eq("id", id);
    } else {
      // Treat as slug (case-insensitive)
      query = query.eq("slug", id.toLowerCase());
    }

    const { data: raffle, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Raffle not found" }, { status: 404 });
      }
      console.error("Error fetching raffle:", error);
      return NextResponse.json({ error: "Failed to fetch raffle" }, { status: 500 });
    }

    // Pull in anyone who joined by calling the contract directly before counting.
    // Throttled + non-throwing: a failure just means we serve the DB as-is.
    await syncRaffleEntriesFromChain(supabase, raffle);

    // Get entries count
    const { data: entriesData, count: participantsCount } = await supabase
      .from("litvm_raffle_entries")
      .select("entry_count", { count: "exact" })
      .eq("raffle_id", raffle.id);

    const totalEntries = entriesData?.reduce((sum, entry) => sum + entry.entry_count, 0) || 0;

    const { data: winners } = await supabase
      .from("litvm_raffle_winners")
      .select("*")
      .eq("raffle_id", raffle.id);

    const { data: prizes } = await supabase
      .from("litvm_raffle_prizes")
      .select("*")
      .eq("raffle_id", raffle.id)
      .order("created_at", { ascending: true });

    // Read on-chain state if deployed
    let chainStatus = undefined;
    if (raffle.chain_raffle_id) {
      try {
        chainStatus = await getOnChainRaffleState(raffle.chain_raffle_id);
      } catch (err) {
        console.error("Error reading on-chain state:", err);
      }
    }

    return NextResponse.json(
      {
        raffle: {
          ...raffle,
          status: getRaffleStatus(raffle.start_date, raffle.end_date, undefined, chainStatus),
        },
        participantsCount: participantsCount || 0,
        entriesCount: totalEntries,
        prizes: prizes || [],
        winners: winners || [],
      },
      { headers: { "Cache-Control": CACHE.raffleDetail } }
    );
  } catch (error) {
    console.error("Error in GET /api/raffles/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
