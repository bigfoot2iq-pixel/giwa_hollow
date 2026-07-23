import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { PrizeType, RaffleStatus } from "@/lib/supabase";
import { getRaffleStatus } from "@/lib/utils/raffles";
import { getOnChainRaffleMeta, ZERO_ADDRESS } from "@/lib/utils/chain";

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
        query = query.lte("end_date", nowIso);
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

    // Sort: active first, then pending, then ended (when not filtering by an explicit status).
    if (!status) {
      const statusOrder: Record<RaffleStatus, number> = { active: 0, pending: 1, ended: 2 };
      enriched.sort((a, b) => {
        const orderA = statusOrder[a.status] ?? 3;
        const orderB = statusOrder[b.status] ?? 3;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.raffle.created_at).getTime() - new Date(a.raffle.created_at).getTime();
      });
    }

    const total = enriched.length;
    const pageSlice = enriched.slice(offset, offset + limit);
    const raffleIds = pageSlice.map((e) => e.raffle.id);

    type CardPrize = {
      prize_type: PrizeType;
      prize_token_address: string;
      prize_amount: string | null;
      prize_token_id: string | null;
    };
    const prizeTypesByRaffle = new Map<string, PrizeType[]>();
    const prizesByRaffle = new Map<string, CardPrize[]>();
    if (raffleIds.length > 0) {
      const { data: prizes, error: prizesError } = await supabase
        .from("litvm_raffle_prizes")
        .select("raffle_id, prize_type, prize_token_address, prize_amount, prize_token_id")
        .in("raffle_id", raffleIds);

      if (prizesError) {
        console.error("Error fetching raffle prizes:", prizesError);
      } else {
        prizes?.forEach((prize) => {
          const existing = prizeTypesByRaffle.get(prize.raffle_id) || [];
          existing.push(prize.prize_type);
          prizeTypesByRaffle.set(prize.raffle_id, existing);

          const fullExisting = prizesByRaffle.get(prize.raffle_id) || [];
          fullExisting.push({
            prize_type: prize.prize_type,
            prize_token_address: prize.prize_token_address,
            prize_amount: prize.prize_amount,
            prize_token_id: prize.prize_token_id,
          });
          prizesByRaffle.set(prize.raffle_id, fullExisting);
        });
      }
    }

    const participantsByRaffle = new Map<string, number>();
    if (raffleIds.length > 0) {
      const counts = await Promise.all(
        raffleIds.map(async (id) => {
          const { count, error: countError } = await supabase
            .from("litvm_raffle_entries")
            .select("*", { count: "exact", head: true })
            .eq("raffle_id", id);
          if (countError) {
            console.error(`Error fetching participant count for raffle ${id}:`, countError);
          }
          return { id, count: count || 0 };
        })
      );
      counts.forEach(({ id, count }) => {
        participantsByRaffle.set(id, count);
      });
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

    return NextResponse.json({
      raffles,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error in GET /api/raffles:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
