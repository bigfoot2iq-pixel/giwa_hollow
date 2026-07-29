import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { CACHE } from "@/lib/utils/cache";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet");

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const walletLower = wallet.toLowerCase();

    const { data, error } = await supabase
      .from("litvm_raffle_admin")
      .select("wallet_address")
      .ilike("wallet_address", walletLower)
      .maybeSingle();

    if (error) {
      console.error("Error checking admin access:", error);
      return NextResponse.json({ error: "Failed to check admin access" }, { status: 500 });
    }

    return NextResponse.json(
      { isAdmin: !!data },
      { headers: { "Cache-Control": CACHE.adminAccess } }
    );
  } catch (error) {
    console.error("Error in GET /api/admin/access:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
