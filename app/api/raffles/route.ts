import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { PrizeType, RaffleStatus } from "@/lib/supabase";
import { getRaffleStatus } from "@/lib/utils/raffles";
import { getOnChainRaffleMeta, ZERO_ADDRESS } from "@/lib/utils/chain";
import { syncManyRaffleEntriesFromChain } from "@/lib/raffles/sync-entries";
import { CACHE } from "@/lib/utils/cache";

// Reads on-chain state and (throttled) reconciles entries, so bound the
// invocation rather than letting a slow upstream burn function duration.
export const maxDuration = 15;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") as RaffleStatus | null;
    // scope splits platform (owner) raffles from community (user-created) raffles.
    // Creator is on-chain truth: address(0) = platform, otherwise community.
    const scope = searchParams.get("scope") as "platform" | "community" | null;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const now = new Date();
    const nowIso = now.toISOString();

    // Fetch every row matching the status filter (no DB range): scope filtering needs the
    // on-chain creator, which isn't a DB column, so pagination is applied after partitioning.
    let query = supabase
      .from("litvm_raffle_raffles")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) {
      if (status === "pending") {
        query = query.gt("start_date", nowIso);
      } else if (status === "active") {
        query = query.lte("start_date", nowIso).gt("end_date", nowIso);
      } else if (status === "ended") {
        // Historical must include raffles ended EARLY on-chain — cancelled or
        // drawn before their end_date — whose end_date is still in the future.
        // A date-only `end_date <= now` filter drops those; they're only
        // distinguishable via chain state, so fetch every started raffle here
        // and narrow to the effective status after reading the chain below.
        query = query.lte("start_date", nowIso);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching raffles:", error);
      return NextResponse.json({ error: "Failed to fetch raffles" }, { status: 500 });
    }

    // Read on-chain meta (state + creator) for every deployed raffle in the result set.
    const chainMeta = await getOnChainRaffleMeta(
      (data || [])
        .filter((r) => r.chain_raffle_id)
        .map((r) => ({ dbId: r.id, chainId: r.chain_raffle_id! }))
    );

    const isCommunity = (raffleId: string) => {
      const creator = chainMeta.get(raffleId)?.creator;
      return !!creator && creator.toLowerCase() !== ZERO_ADDRESS;
    };

    // Partition by scope, compute status, then sort + paginate the matching set.
    const filteredRows = (data || []).filter((raffle) => {
      if (scope === "platform") return !isCommunity(raffle.id);
      if (scope === "community") return isCommunity(raffle.id);
      return true;
    });

    const enriched = filteredRows.map((raffle) => ({
      raffle,
      status: getRaffleStatus(raffle.start_date, raffle.end_date, now, chainMeta.get(raffle.id)?.status),
    }));

    // The DB pre-filter is date-based, but a raffle's real status can diverge
    // from its dates: cancelled or drawn early on-chain keeps a future end_date.
    // Narrow to the effective (chain-aware) status so those leave Live and land
    // in Historical, instead of showing under the tab their dates imply.
    const statusFiltered = status
      ? enriched.filter((e) => e.status === status)
      : enriched;

    // Sort: active first, then pending, then ended (when not filtering by an explicit status).
    if (!status) {
      const statusOrder: Record<RaffleStatus, number> = { active: 0, pending: 1, ended: 2 };
      statusFiltered.sort((a, b) => {
        const orderA = statusOrder[a.status] ?? 3;
        const orderB = statusOrder[b.status] ?? 3;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.raffle.created_at).getTime() - new Date(a.raffle.created_at).getTime();
      });
    }

    const total = statusFiltered.length;
    const pageSlice = statusFiltered.slice(offset, offset + limit);
    const raffleIds = pageSlice.map((e) => e.raffle.id);

    type CardPrize = {
      prize_type: PrizeType;
      prize_token_address: string;
      prize_amount: string | null;
      prize_token_id: string | null;
    };
    // Prizes and participant counts for the visible page, in one call. These
    // were two separate PostgREST round trips; on this route the round-trip
    // count is what drives Supabase egress, since every response carries ~1.2 KB
    // of headers whatever the body size.
    const prizeTypesByRaffle = new Map<string, PrizeType[]>();
    const prizesByRaffle = new Map<string, CardPrize[]>();
    const participantsByRaffle = new Map<string, number>();
    if (raffleIds.length > 0) {
      const { data: pageMeta, error: pageMetaError } = await supabase.rpc(
        "litvm_raffle_page_meta",
        { p_raffle_ids: raffleIds }
      );

      if (pageMetaError) {
        console.error("Error fetching raffle page meta:", pageMetaError);
      } else {
        for (const row of (pageMeta ?? []) as Array<{
          raffle_id: string;
          participants: number | string;
          prizes: CardPrize[] | null;
        }>) {
          participantsByRaffle.set(row.raffle_id, Number(row.participants) || 0);

          const prizes = row.prizes ?? [];
          prizesByRaffle.set(row.raffle_id, prizes);
          prizeTypesByRaffle.set(
            row.raffle_id,
            prizes.map((prize) => prize.prize_type)
          );
        }
      }
    }

    // Reconcile the visible page against EntrySubmitted logs first, so wallets
    // that joined via the contract directly are counted.
    //
    // Restricted to active raffles: pending ones cannot have entries yet, and
    // ended ones were already reconciled by the settle cron before the draw.
    // This is the highest-traffic route, so the fan-out is kept as small as
    // possible — the persisted throttle inside caps it further.
    const syncable = pageSlice
      .filter(({ status: s }) => s === "active")
      .map(({ raffle }) => raffle);
    if (syncable.length > 0) {
      await syncManyRaffleEntriesFromChain(supabase, syncable);
    }

    const raffles = pageSlice.map(({ raffle, status: raffleStatus }) => {
      const prizeTypes = prizeTypesByRaffle.get(raffle.id) || [];
      const uniquePrizeTypes = Array.from(new Set(prizeTypes));

      return {
        ...raffle,
        status: raffleStatus,
        prize_types: uniquePrizeTypes,
        prizes: prizesByRaffle.get(raffle.id) || [],
        participants_count: participantsByRaffle.get(raffle.id) || 0,
      };
    });

    return NextResponse.json(
      { raffles, total, limit, offset },
      { headers: { "Cache-Control": CACHE.raffles } }
    );
  } catch (error) {
    console.error("Error in GET /api/raffles:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
