import { NextRequest, NextResponse } from "next/server";
import { CACHE } from "@/lib/utils/cache";
import {
  fetchTokenMetadata,
  parseTokenId,
} from "@/lib/launchpad/collection";

export const dynamic = "force-dynamic";

/**
 * Public ERC-721 metadata proxy.
 *
 * The contract's base URI points here, so it requests `/metadata/1.json`.
 * The Pinata metadata is read server-side and its `image` field is rewritten
 * to this app's image proxy, hiding the original IPFS directory from callers.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId: rawTokenId } = await params;
  const tokenId = parseTokenId(rawTokenId);

  if (!tokenId) {
    return NextResponse.json({ error: "Unknown token" }, { status: 404 });
  }

  try {
    const metadata = await fetchTokenMetadata(tokenId);
    // Prefer an explicitly configured origin. Falling back to the request host
    // makes the publicly cached JSON depend on the Host header, which is a
    // cache-poisoning foot-gun on any deployment with wildcard hostnames.
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.nextUrl.origin;

    return NextResponse.json(
      {
        ...metadata,
        image: `${origin}/api/launchpad/image/${tokenId}.png`,
      },
      {
        headers: {
          "Cache-Control": CACHE.launchpadMetadata,
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch (error) {
    console.error(`Error proxying launchpad metadata for token ${tokenId}:`, error);
    return NextResponse.json(
      { error: "Metadata unavailable" },
      { status: 502 }
    );
  }
}
