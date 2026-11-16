import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  parseEventLogs,
} from "viem";
import { createServiceClient } from "@/lib/supabase/server";
import { CACHE } from "@/lib/utils/cache";
import { contracts, giwaSepolia, RobinhoodRafflesABI } from "@/lib/contracts";
import { checkRateLimit, rateLimitResponse } from "@/lib/utils/rateLimit";
import { z } from "zod";

const verifyEntrySchema = z.object({
  raffleId: z.string().uuid(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  // Kept for wire compatibility with older clients. The authoritative values
  // are derived from the EntrySubmitted log below, never from this payload.
  tokensSpent: z.number().positive().optional(),
  entryCount: z.number().positive().optional(),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

const entryLookupSchema = z.object({
  raffleId: z.string().uuid(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const TOKEN_DECIMALS = 10n ** 18n;
const RPC_TIMEOUT_MS = 8_000;

function getPublicClient() {
  return createPublicClient({
    chain: giwaSepolia,
    transport: http(
      process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL,
      { timeout: RPC_TIMEOUT_MS, retryCount: 1 },
    ),
  });
}

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

    return NextResponse.json(
      {
        tokensSpent: data?.tokens_spent || 0,
        entryCount: data?.entry_count || 0,
      },
      { headers: { "Cache-Control": CACHE.walletEntry } }
    );
  } catch (error) {
    console.error("Error in GET /api/entries:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Verify a `joinRaffle` transaction and return only the entry data the chain
 * proves. The client payload is a hint; the `EntrySubmitted` log emitted by
 * the raffles contract is the source of truth.
 *
 * This closes a critical hole: previously any successful transaction hash was
 * accepted, and `entryCount`/`tokensSpent` were written verbatim. A caller
 * could therefore mint unlimited raffle tickets for any wallet without ever
 * paying — and settlement builds the on-chain draw from these rows.
 */
async function readVerifiedEntry(params: {
  txHash: `0x${string}`;
  chainRaffleId: number;
  walletAddress: string;
  tokensRequired: number;
}): Promise<
  | { ok: true; tickets: bigint; entryCount: number; tokensSpent: number }
  | { ok: false; error: string }
> {
  const { txHash, chainRaffleId, walletAddress, tokensRequired } = params;

  if (!contracts.raffles.address || !isAddress(contracts.raffles.address)) {
    return { ok: false, error: "Raffle contract is not configured" };
  }
  if (!Number.isSafeInteger(tokensRequired) || tokensRequired <= 0) {
    return { ok: false, error: "Raffle has an invalid token requirement" };
  }

  const client = getPublicClient();

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch {
    return { ok: false, error: "Transaction not found on chain" };
  }

  if (receipt.status !== "success") {
    return { ok: false, error: "Transaction failed on-chain. Entry not recorded." };
  }

  const raffleContract = getAddress(contracts.raffles.address);

  let logs;
  try {
    logs = parseEventLogs({
      abi: RobinhoodRafflesABI,
      eventName: "EntrySubmitted",
      logs: receipt.logs,
    });
  } catch {
    return { ok: false, error: "Could not decode raffle events" };
  }

  const wallet = getAddress(walletAddress);
  const tokensWei = logs.reduce((sum, log) => {
    // Match the emitting contract too: another contract can emit an event with
    // the same signature, and only the raffles contract's log proves a join.
    if (getAddress(log.address) !== raffleContract) return sum;
    const args = log.args as {
      raffleId?: bigint;
      participant?: string;
      tokensSpent?: bigint;
    };
    if (args.raffleId === undefined || !args.participant) return sum;
    if (Number(args.raffleId) !== chainRaffleId) return sum;
    if (getAddress(args.participant) !== wallet) return sum;
    return sum + (args.tokensSpent ?? 0n);
  }, 0n);

  if (tokensWei <= 0n) {
    return {
      ok: false,
      error: "No matching EntrySubmitted event for this raffle and wallet",
    };
  }

  const wholeTokens = tokensWei / TOKEN_DECIMALS;
  const tickets = wholeTokens / BigInt(tokensRequired);
  if (tickets <= 0n) {
    return { ok: false, error: "Payment did not cover a single entry" };
  }

  const entryCount = Number(tickets);
  if (!Number.isSafeInteger(entryCount) || entryCount <= 0) {
    return { ok: false, error: "Entry count out of range" };
  }

  return {
    ok: true,
    tickets,
    entryCount,
    tokensSpent: entryCount * tokensRequired,
  };
}

export async function POST(request: NextRequest) {
  // Each call performs two RPC reads and several DB round-trips. Throttle the
  // source before spending any of that budget.
  const rate = checkRateLimit(request, "entries:post", {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.ok) return rateLimitResponse(rate.retryAfterSeconds);

  try {
    const body = await request.json();
    const validation = verifyEntrySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { raffleId, walletAddress, txHash } = validation.data;
    const supabase = await createServiceClient();
    const walletLower = walletAddress.toLowerCase();

    // Check if entry already exists before spending an RPC round-trip.
    const { data: existingEntry } = await supabase
      .from("litvm_raffle_entries")
      .select("id")
      .eq("tx_hash", txHash)
      .single();

    if (existingEntry) {
      return NextResponse.json({ error: "Entry already recorded" }, { status: 409 });
    }

    // Only read the columns the verification and write need.
    const { data: raffle, error: raffleError } = await supabase
      .from("litvm_raffle_raffles")
      .select(
        "id, chain_raffle_id, tokens_required, max_entries_per_user, max_participants, start_date, end_date"
      )
      .eq("id", raffleId)
      .single();

    if (raffleError || !raffle) {
      return NextResponse.json({ error: "Raffle not found" }, { status: 404 });
    }

    if (raffle.chain_raffle_id === null || raffle.chain_raffle_id === undefined) {
      return NextResponse.json(
        { error: "Raffle is not deployed on-chain" },
        { status: 400 }
      );
    }

    const now = new Date();
    if (now < new Date(raffle.start_date) || now >= new Date(raffle.end_date)) {
      return NextResponse.json({ error: "Raffle is not active" }, { status: 400 });
    }

    const verified = await readVerifiedEntry({
      txHash: txHash as `0x${string}`,
      chainRaffleId: Number(raffle.chain_raffle_id),
      walletAddress,
      tokensRequired: Number(raffle.tokens_required),
    });

    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: 400 });
    }

    const { entryCount, tokensSpent } = verified;

    // Check if user already has an entry (to update) or create new.
    const { data: existingUserEntry } = await supabase
      .from("litvm_raffle_entries")
      .select("id, entry_count, tokens_spent")
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
    const maxEntries = Number(raffle.max_entries_per_user);
    if (maxEntries > 0 && nextEntryCount > maxEntries) {
      return NextResponse.json(
        { error: "Exceeded max entries per user" },
        { status: 400 }
      );
    }

    const nextTotalTokens = (existingUserEntry?.tokens_spent || 0) + tokensSpent;

    if (existingUserEntry) {
      const { error: updateError } = await supabase
        .from("litvm_raffle_entries")
        .update({
          tokens_spent: nextTotalTokens,
          entry_count: nextEntryCount,
          tx_hash: txHash,
        })
        .eq("id", existingUserEntry.id);

      if (updateError) {
        console.error("Error updating entry:", updateError);
        return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
      }
    } else {
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
        // A concurrent request recorded this exact tx first.
        if (insertError.code === "23505") {
          return NextResponse.json({ error: "Entry already recorded" }, { status: 409 });
        }
        return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
      }
    }

    // Record transaction and update user stats. These are best-effort: the
    // entry itself is already durable, so a failure here must not 500 the
    // caller and lose their success state.
    const { error: txError } = await supabase
      .from("litvm_raffle_transactions")
      .insert({
        wallet_address: walletLower,
        type: "raffle_entry",
        amount: tokensSpent.toString(),
        tx_hash: txHash,
        raffle_id: raffleId,
      });

    if (txError && txError.code !== "23505") {
      console.error("Error recording raffle transaction:", txError);
    }

    await supabase.rpc("litvm_raffle_increment_user_entries", {
      p_wallet: walletLower,
      p_count: entryCount,
    });

    return NextResponse.json({ success: true, entryCount, tokensSpent });
  } catch (error) {
    console.error("Error in POST /api/entries:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
