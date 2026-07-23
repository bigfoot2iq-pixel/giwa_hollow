import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdminSignature } from "@/lib/utils/auth";
import { RobinhoodRafflesABI, contracts, giwaSepolia } from "@/lib/contracts";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminSignature(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createServiceClient();

    // Check if id is a UUID or a slug
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(id);

    let raffleQuery = supabase
      .from("litvm_raffle_raffles")
      .select("*");

    if (isUuid) {
      raffleQuery = raffleQuery.eq("id", id);
    } else {
      raffleQuery = raffleQuery.eq("slug", id.toLowerCase());
    }

    const { data: raffle, error: raffleError } = await raffleQuery.single();

    if (raffleError || !raffle) {
      return NextResponse.json({ error: "Raffle not found" }, { status: 404 });
    }

    if (!raffle.chain_raffle_id) {
      return NextResponse.json({ error: "Raffle not deployed on chain" }, { status: 400 });
    }

    // Setup blockchain clients
    const raffleContract = contracts.raffles.address;
    const privateKey = process.env.WATCHDOG_PRIVATE_KEY;
    if (!raffleContract || !privateKey) {
      return NextResponse.json({ error: "Missing contract configuration" }, { status: 500 });
    }

    const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rpc.giwa.io";
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const publicClient = createPublicClient({
      chain: giwaSepolia,
      transport: http(rpcUrl),
    });
    const walletClient = createWalletClient({
      chain: giwaSepolia,
      transport: http(rpcUrl),
      account,
    });

    // Activate raffle on chain
    const txHash = await walletClient.writeContract({
      address: raffleContract,
      abi: RobinhoodRafflesABI,
      functionName: "activateRaffle",
      args: [BigInt(raffle.chain_raffle_id)],
    });

    console.log("Raffle activate tx sent", { txHash, raffleId: id });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log("Raffle activate tx mined", { txHash, status: receipt.status });

    if (receipt.status !== "success") {
      return NextResponse.json({ error: "Transaction failed" }, { status: 500 });
    }

    // Log admin action
    const adminWallet = request.headers.get("x-admin-wallet") || "unknown";
    await supabase.from("litvm_raffle_admin_logs").insert({
      admin_wallet: adminWallet,
      action: "activate_raffle",
      details: { raffle_id: id, tx_hash: txHash },
    });

    return NextResponse.json({ success: true, txHash });
  } catch (error) {
    console.error("Error in POST /api/admin/raffles/[id]/activate:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}
