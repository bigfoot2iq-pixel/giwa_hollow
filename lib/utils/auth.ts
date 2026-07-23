import { NextRequest } from "next/server";
import { verifyMessage } from "viem";
import { createServiceClient } from "@/lib/supabase/server";

async function isAdminWallet(wallet: string) {
  const supabase = await createServiceClient();
  const walletLower = wallet.toLowerCase();

  const { data, error } = await supabase
    .from("litvm_raffle_admin")
    .select("wallet_address")
    .ilike("wallet_address", walletLower)
    .maybeSingle();

  if (error) {
    console.error("Error checking admin wallet:", error);
    return false;
  }

  return !!data;
}

export async function verifyAdminSignature(request: NextRequest): Promise<boolean> {
  try {
    const wallet = request.headers.get("x-admin-wallet");
    const signature = request.headers.get("x-admin-signature");
    const timestamp = request.headers.get("x-admin-timestamp");

    if (!wallet || !signature || !timestamp) {
      return false;
    }

    // Check if wallet is admin
    const isAdmin = await isAdminWallet(wallet);
    if (!isAdmin) {
      return false;
    }

    // Check timestamp (valid for 5 minutes)
    const timestampNum = parseInt(timestamp);
    const now = Date.now();
    if (isNaN(timestampNum) || now - timestampNum > 5 * 60 * 1000) {
      return false;
    }

    // Verify signature
    const message = `GIWA Raffles Admin\nTimestamp: ${timestamp}`;
    const isValid = await verifyMessage({
      address: wallet as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    return isValid;
  } catch (error) {
    console.error("Error verifying admin signature:", error);
    return false;
  }
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
