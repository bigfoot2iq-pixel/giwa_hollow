import { NextRequest } from "next/server";
import { isAddress, verifyMessage } from "viem";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rateLimit";

// The client caches one signature for five minutes, so the server window must
// accept signatures that age. Anything further in the past — or in the future
// (a clock-skew / replay trick the old one-sided check missed) — is rejected.
const ADMIN_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;
const ADMIN_CLOCK_SKEW_MS = 30 * 1000;

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
    // Every admin route funnels through here, so this is the one place a
    // request flood can be stopped before it becomes a DB lookup + signature
    // verification. 60/min leaves room for a dashboard's parallel reads.
    const rate = checkRateLimit(request, "admin-auth", {
      limit: 60,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return false;
    }

    const wallet = request.headers.get("x-admin-wallet");
    const signature = request.headers.get("x-admin-signature");
    const timestamp = request.headers.get("x-admin-timestamp");

    if (!wallet || !signature || !timestamp) {
      return false;
    }

    // Reject malformed addresses before they reach viem or the admin lookup.
    // Without this, a header like "%" becomes an `ilike` wildcard in Postgres.
    if (!isAddress(wallet, { strict: false })) {
      return false;
    }

    // Check if wallet is admin
    const isAdmin = await isAdminWallet(wallet);
    if (!isAdmin) {
      return false;
    }

    // Timestamp must be numeric and inside a symmetric freshness window:
    // rejecting only old timestamps lets a far-future one replay forever.
    const timestampNum = Number(timestamp);
    const age = Date.now() - timestampNum;
    if (
      !Number.isFinite(timestampNum) ||
      age > ADMIN_SIGNATURE_MAX_AGE_MS ||
      age < -ADMIN_CLOCK_SKEW_MS
    ) {
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
