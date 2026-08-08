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

    // The entry reconcile, the winners/prizes reads, and the on-chain state read
    // are mutually independent — only the entries count below depends on the
    // reconcile having written any direct-contract entrants. Overlap the four so
    // this route costs one round-trip's worth of latency instead of the sum of
    // four sequential ones (it was ~6 serial trips before).
    //
    // Sync never throws; the chain read is wrapped so a slow RPC can't reject the
    // batch (it falls back to date-derived status, exactly as before).
    const [, winnersResult, prizesResult, chainStatus] = await Promise.all([
      syncRaffleEntriesFromChain(supabase, raffle),
      supabase.from("litvm_raffle_winners").select("*").eq("raffle_id", raffle.id),
      supabase
        .from("litvm_raffle_prizes")
        .select("*")
        .eq("raffle_id", raffle.id)
        .order("created_at", { ascending: true }),
      raffle.chain_raffle_id
        ? getOnChainRaffleState(raffle.chain_raffle_id).catch((err) => {
            console.error("Error reading on-chain state:", err);
            return undefined;
          })
        : Promise.resolve(undefined),
    ]);

    const winners = winnersResult.data;
    const prizes = prizesResult.data;

    // Entries count runs after the reconcile so direct-contract entrants are
    // included in the participant/entry totals.
    const { data: entriesData, count: participantsCount } = await supabase
      .from("litvm_raffle_entries")
      .select("entry_count", { count: "exact" })
      .eq("raffle_id", raffle.id);

    const totalEntries = entriesData?.reduce((sum, entry) => sum + entry.entry_count, 0) || 0;

    // Display-count overrides for raffles whose entry rows were pruned (see
    // 20260808_add_participants_display.sql). Null falls back to the real counts.
    const displayParticipants = raffle.participants_display ?? (participantsCount || 0);
    const displayEntries = raffle.entries_display ?? totalEntries;

    return NextResponse.json(
      {
        raffle: {
          ...raffle,
          status: getRaffleStatus(raffle.start_date, raffle.end_date, undefined, chainStatus),
        },
        participantsCount: displayParticipants,
        entriesCount: displayEntries,
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
