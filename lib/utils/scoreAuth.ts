import { createPublicClient, http, getAddress, isAddress } from "viem";
import { giwaSepolia } from "@/lib/contracts";

/**
 * Canonical message a player signs to authorize a score submission. Binding
 * wallet + session + score means a captured signature cannot be replayed for a
 * different score or a different session (sessions are single-use). Both client
 * and server MUST build the message identically, so this is the only source.
 */
export function buildScoreMessage(p: {
  walletAddress: string;
  sessionId: string;
  score: number;
}): string {
  return [
    "ARIWA — Score Submission",
    `wallet: ${getAddress(p.walletAddress)}`,
    `session: ${p.sessionId}`,
    `score: ${p.score}`,
  ].join("\n");
}

/**
 * Verify the score submission was signed by `walletAddress`. Uses viem's
 * verifyMessage so both EOA signatures and smart-contract wallets (EIP-1271)
 * are supported. Returns false on any malformed input or verification failure.
 */
export async function verifyScoreSignature(p: {
  walletAddress: string;
  sessionId: string;
  score: number;
  signature: string;
}): Promise<boolean> {
  if (!isAddress(p.walletAddress)) return false;
  if (typeof p.signature !== "string" || !p.signature.startsWith("0x")) {
    return false;
  }

  const client = createPublicClient({
    chain: giwaSepolia,
    transport: http(process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL),
  });

  try {
    return await client.verifyMessage({
      address: getAddress(p.walletAddress),
      message: buildScoreMessage(p),
      signature: p.signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}

// Score plausibility bounds. The game is client-authoritative, so these cannot
// stop a determined cheater who submits a "believable" score — they exist to
// reject the absurd (e.g. 9_999_999 in a 10s session). Tuned generously to
// avoid rejecting legitimate skilled runs; adjust if real scores approach them.
export const SCORE_ABSOLUTE_MAX = 50_000_000;
export const SCORE_MAX_POINTS_PER_SECOND = 300;
export const SCORE_GRACE = 2_000; // flat allowance for short early bursts

export function isScorePlausible(score: number, sessionCreatedAt: string): boolean {
  if (!Number.isFinite(score) || score < 0) return false;
  if (score > SCORE_ABSOLUTE_MAX) return false;
  const elapsedSec = (Date.now() - new Date(sessionCreatedAt).getTime()) / 1000;
  if (elapsedSec < 0) return false; // clock skew / bad timestamp
  const maxPlausible = SCORE_GRACE + elapsedSec * SCORE_MAX_POINTS_PER_SECOND;
  return score <= maxPlausible;
}
