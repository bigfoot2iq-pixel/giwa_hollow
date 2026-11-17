import { NextRequest, NextResponse } from "next/server";
import { CACHE } from "@/lib/utils/cache";
import {
  fetchTokenMetadata,
  parseTokenId,
} from "@/lib/launchpad/collection";
import { LEGACY_IMAGE_VERSION } from "@/lib/launchpad/constants";
import { getAppOrigin, publicImageUrl } from "@/lib/launchpad/storage";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

function responseHeaders(headOnly: boolean): Record<string, string> {
  return {
    ...CORS_HEADERS,
    ...(headOnly ? { "Content-Type": "application/json; charset=utf-8" } : {}),
    "Cache-Control": CACHE.launchpadMetadata,
    "X-Content-Type-Options": "nosniff",
  };
}

async function buildMetadataResponse(
  request: NextRequest,
  rawTokenId: string,
  headOnly: boolean
): Promise<NextResponse> {
  const tokenId = parseTokenId(rawTokenId);

  if (!tokenId) {
    return NextResponse.json(
      { error: "Unknown token" },
      { status: 404, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } }
    );
  }

  try {
    const { metadata, source } = await fetchTokenMetadata(tokenId);
    const origin = getAppOrigin(request.nextUrl.origin);

    const image =
      source.kind === "r2"
        ? publicImageUrl(
            origin,
            tokenId,
            source.active.imageExtension,
            source.active.version
          )
        : `${origin}/api/launchpad/image/${tokenId}.png?v=${LEGACY_IMAGE_VERSION}`;

    const body = { ...metadata, image };

    if (headOnly) {
      return new NextResponse(null, {
        status: 200,
        headers: responseHeaders(true),
      });
    }

    return NextResponse.json(body, { headers: responseHeaders(false) });
  } catch (error) {
    console.error(
      `Error proxying launchpad metadata for token ${tokenId}:`,
      error
    );

    return NextResponse.json(
      { error: "Metadata unavailable" },
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
      }
    );
  }
}

/**
 * Public ERC-721 metadata proxy.
 *
 * The contract's base URI points here, so it requests `/metadata/1.json`.
 * The private R2 object (or the legacy Pinata fallback) is read server-side
 * and its `image` field is rewritten to this app's image proxy, hiding the
 * storage origin from callers.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId } = await params;
  return buildMetadataResponse(request, tokenId, false);
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId } = await params;
  return buildMetadataResponse(request, tokenId, true);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
