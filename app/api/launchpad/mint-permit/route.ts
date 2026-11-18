import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  createMintPermit,
  getIpMintStatus,
} from "@/lib/launchpad/ip-gate";
import {
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/utils/rateLimit";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Read whether this network already minted. Used by the page and by the mint
 * panel to keep the UI honest after a transaction.
 */
export async function GET(request: NextRequest) {
  const status = await getIpMintStatus(request.headers);
  return NextResponse.json(status, { headers: NO_STORE });
}

/**
 * Issue the EIP-712 permit the collection requires for a public mint.
 *
 * The route is intentionally unauthenticated: a wallet address is not a
 * credential, and the permit is bound to both the requesting network and the
 * wallet, so it cannot be used by anyone else or more than once on-chain.
 */
export async function POST(request: NextRequest) {
  // Signatures are cheap, but this route sits on the public internet. A small
  // per-instance limit keeps a loop from hammering the RPC reads.
  const limit = checkRateLimit(request, "launchpad-mint-permit", {
    limit: 12,
    windowMs: 60_000,
  });
  if (!limit.ok) {
    return rateLimitResponse(limit.retryAfterSeconds);
  }

  let wallet: string | undefined;
  try {
    const body = (await request.json()) as { address?: unknown };
    wallet = typeof body.address === "string" ? body.address : undefined;
  } catch {
    wallet = undefined;
  }

  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json(
      { error: "A valid wallet address is required.", code: "invalid_wallet" },
      { status: 400, headers: NO_STORE }
    );
  }

  const result = await createMintPermit(request.headers, wallet);

  if (!result.ok) {
    const status =
      result.code === "already_minted"
        ? 403
        : result.code === "not_configured"
          ? 503
          : 502;

    return NextResponse.json(
      { error: result.error, code: result.code },
      { status, headers: NO_STORE }
    );
  }

  return NextResponse.json(result.permit, { headers: NO_STORE });
}
