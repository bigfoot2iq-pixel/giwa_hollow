import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet");

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      console.warn("[AdminAccess] Invalid wallet", wallet);
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const walletLower = wallet.toLowerCase();

    console.info("[AdminAccess] Checking wallet", walletLower);
    const { data, error } = await supabase
      .from("litvm_raffle_admin")
      .select("wallet_address")
      .ilike("wallet_address", walletLower)
      .maybeSingle();

    if (error) {
      console.error("Error checking admin access:", error);
      return NextResponse.json({ error: "Failed to check admin access" }, { status: 500 });
    }

    console.info("[AdminAccess] Wallet result", { wallet: walletLower, isAdmin: !!data });
    return NextResponse.json({ isAdmin: !!data });
  } catch (error) {
    console.error("Error in GET /api/admin/access:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
