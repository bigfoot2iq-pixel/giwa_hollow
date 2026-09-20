import { createPublicClient, http, getAddress, isAddress } from "viem";
import { giwaSepolia } from "@/lib/contracts";

/**
 * Canonical message a player signs to update their profile. Binding wallet +
 * username + timestamp means a captured signature cannot be replayed for a
 * different username, and expires five minutes after it was produced. Both the
 * client and the server MUST build the message identically, so this is the
 * only source of truth.
 */
export function buildProfileUpdateMessage(p: {
  walletAddress: string;
  username: string;
  timestamp: number;
}): string {
  return [
    "ARIWA — Profile Update",
    `wallet: ${getAddress(p.walletAddress)}`,
    `username: ${p.username}`,
    `timestamp: ${p.timestamp}`,
  ].join("\n");
}

export const PROFILE_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Verify a profile update was signed by `walletAddress`. Uses viem's
 * verifyMessage so both EOA signatures and smart-contract wallets (EIP-1271)
 * are supported. Returns false on any malformed input or failed verification.
 */
export async function verifyProfileSignature(p: {
  walletAddress: string;
  username: string;
  timestamp: number;
  signature: string;
}): Promise<boolean> {
  if (!isAddress(p.walletAddress)) return false;
  if (typeof p.signature !== "string" || !p.signature.startsWith("0x")) {
    return false;
  }
  if (
    typeof p.timestamp !== "number" ||
    !Number.isFinite(p.timestamp) ||
    Math.abs(Date.now() - p.timestamp) > PROFILE_SIGNATURE_MAX_AGE_MS
  ) {
    return false;
  }

  const client = createPublicClient({
    chain: giwaSepolia,
    transport: http(process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL),
  });

  try {
    return await client.verifyMessage({
      address: getAddress(p.walletAddress),
      message: buildProfileUpdateMessage(p),
      signature: p.signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}
