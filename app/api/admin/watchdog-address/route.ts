import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSignature } from "@/lib/utils/auth";
import { privateKeyToAccount } from "viem/accounts";

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSignature(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const privateKey = process.env.WATCHDOG_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { error: "Watchdog private key not configured" },
        { status: 500 }
      );
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);

    return NextResponse.json({
      address: account.address,
    });
  } catch (error) {
    console.error("Error in GET /api/admin/watchdog-address:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
