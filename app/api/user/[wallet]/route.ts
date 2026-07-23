import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getRaffleStatus } from "@/lib/utils/raffles";
import { getOnChainRaffleStates } from "@/lib/utils/chain";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const walletLower = wallet.toLowerCase();

    // Get or create user
    let { data: user } = await supabase
      .from("litvm_raffle_users")
      .select("*")
      .eq("wallet_address", walletLower)
      .single();

    if (!user) {
      const { data: newUser, error: createError } = await supabase
        .from("litvm_raffle_users")
        .insert({ wallet_address: walletLower })
        .select()
        .single();
      
      if (createError) {
        console.error("Error creating user:", createError);
      } else {
        user = newUser;
      }
    }

    // Get user entries with chain_raffle_id for on-chain status
    const { data: entries } = await supabase
      .from("litvm_raffle_entries")
      .select(`
        *,
        raffle:litvm_raffle_raffles(id, slug, title, start_date, end_date, chain_raffle_id)
      `)
      .eq("wallet_address", walletLower)
      .order("created_at", { ascending: false })
      .limit(50);

    // Get user wins
    const { data: wins } = await supabase
      .from("litvm_raffle_winners")
      .select(`
        *,
        raffle:litvm_raffle_raffles(id, slug, title)
      `)
      .eq("wallet_address", walletLower)
      .order("created_at", { ascending: false })
      .limit(50);

    // Get recent transactions
    const { data: transactions } = await supabase
      .from("litvm_raffle_transactions")
      .select("*")
      .eq("wallet_address", walletLower)
      .order("created_at", { ascending: false })
      .limit(20);

    // Read on-chain state for entry raffles
    const chainRaffleIds = (entries || [])
      .filter((e) => e.raffle?.chain_raffle_id)
      .map((e) => ({ dbId: e.raffle!.id, chainId: e.raffle!.chain_raffle_id! }));
    const uniqueChainIds = chainRaffleIds.filter(
      (r, i, arr) => arr.findIndex((x) => x.dbId === r.dbId) === i
    );
    const chainStates = await getOnChainRaffleStates(uniqueChainIds);

    return NextResponse.json({
      user,
      entries: (entries || []).map((entry) => ({
        ...entry,
        raffle: entry.raffle
          ? {
              ...entry.raffle,
              status: getRaffleStatus(entry.raffle.start_date, entry.raffle.end_date, undefined, chainStates.get(entry.raffle.id)),
            }
          : entry.raffle,
      })),
      wins: wins || [],
      transactions: transactions || [],
    });
  } catch (error) {
    console.error("Error in GET /api/user/[wallet]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
