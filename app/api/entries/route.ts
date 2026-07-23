import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

const verifyEntrySchema = z.object({
  raffleId: z.string().uuid(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokensSpent: z.number().positive(),
  entryCount: z.number().positive(),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

const entryLookupSchema = z.object({
  raffleId: z.string().uuid(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const validation = entryLookupSchema.safeParse({
      raffleId: searchParams.get("raffleId"),
      walletAddress: searchParams.get("walletAddress"),
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { raffleId, walletAddress } = validation.data;
    const supabase = await createServiceClient();
    const walletLower = walletAddress.toLowerCase();

    const { data, error } = await supabase
      .from("litvm_raffle_entries")
      .select("tokens_spent, entry_count")
      .eq("raffle_id", raffleId)
      .eq("wallet_address", walletLower)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching entry:", error);
      return NextResponse.json({ error: "Failed to fetch entry" }, { status: 500 });
    }

    return NextResponse.json({
      tokensSpent: data?.tokens_spent || 0,
      entryCount: data?.entry_count || 0,
    });
  } catch (error) {
    console.error("Error in GET /api/entries:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = verifyEntrySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { raffleId, walletAddress, tokensSpent, entryCount, txHash } = validation.data;
    const supabase = await createServiceClient();
    const walletLower = walletAddress.toLowerCase();

    // Verify transaction on-chain before recording
    try {
      const { createPublicClient, http } = await import("viem");
      const { giwaSepolia } = await import("@/lib/contracts/config");
      
      const publicClient = createPublicClient({
        chain: giwaSepolia,
        transport: http(process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rpc.giwa.io"),
      });

      const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
      
      if (receipt.status !== "success") {
        return NextResponse.json(
          { error: "Transaction failed on-chain. Entry not recorded." },
          { status: 400 }
        );
      }
    } catch (txError) {
      console.error("Error verifying transaction:", txError);
      return NextResponse.json(
        { error: "Failed to verify transaction on-chain" },
        { status: 400 }
      );
    }

    // Check if entry already exists
    const { data: existingEntry } = await supabase
      .from("litvm_raffle_entries")
      .select("id")
      .eq("tx_hash", txHash)
      .single();

    if (existingEntry) {
      return NextResponse.json({ error: "Entry already recorded" }, { status: 409 });
    }

    // Check if raffle exists and is active
    const { data: raffle, error: raffleError } = await supabase
      .from("litvm_raffle_raffles")
      .select("*")
      .eq("id", raffleId)
      .single();

    if (raffleError || !raffle) {
      return NextResponse.json({ error: "Raffle not found" }, { status: 404 });
    }

    const now = new Date();
    if (now < new Date(raffle.start_date) || now >= new Date(raffle.end_date)) {
      return NextResponse.json({ error: "Raffle is not active" }, { status: 400 });
    }

    // Check if user already has an entry (to update) or create new
    const { data: existingUserEntry } = await supabase
      .from("litvm_raffle_entries")
      .select("*")
      .eq("raffle_id", raffleId)
      .eq("wallet_address", walletLower)
      .single();

    if (!existingUserEntry) {
      const { count: participantsCount } = await supabase
        .from("litvm_raffle_entries")
        .select("id", { count: "exact", head: true })
        .eq("raffle_id", raffleId);

      if ((participantsCount || 0) >= raffle.max_participants) {
        return NextResponse.json({ error: "Raffle is full" }, { status: 400 });
      }
    }

    const nextEntryCount = (existingUserEntry?.entry_count || 0) + entryCount;
    if (nextEntryCount > raffle.max_entries_per_user) {
      return NextResponse.json({ error: "Exceeded max entries per user" }, { status: 400 });
    }

    const nextTotalTokens = (existingUserEntry?.tokens_spent || 0) + tokensSpent;

    if (existingUserEntry) {
      // Update existing entry
      const { error: updateError } = await supabase
        .from("litvm_raffle_entries")
        .update({
          tokens_spent: nextTotalTokens,
          entry_count: existingUserEntry.entry_count + entryCount,
          tx_hash: txHash,
        })
        .eq("id", existingUserEntry.id);

      if (updateError) {
        console.error("Error updating entry:", updateError);
        return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
      }
    } else {
      // Create new entry
      const { error: insertError } = await supabase
        .from("litvm_raffle_entries")
        .insert({
          raffle_id: raffleId,
          wallet_address: walletLower,
          tokens_spent: tokensSpent,
          entry_count: entryCount,
          tx_hash: txHash,
        });

      if (insertError) {
        console.error("Error creating entry:", insertError);
        return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
      }

    }

    // Record transaction
    await supabase.from("litvm_raffle_transactions").insert({
      wallet_address: walletLower,
      type: "raffle_entry",
      amount: tokensSpent.toString(),
      tx_hash: txHash,
      raffle_id: raffleId,
    });

    // Update user stats
    await supabase.rpc("litvm_raffle_increment_user_entries", {
      p_wallet: walletLower,
      p_count: entryCount,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST /api/entries/verify:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
