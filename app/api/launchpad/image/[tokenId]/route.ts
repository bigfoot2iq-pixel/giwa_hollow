import { NextResponse } from "next/server";
import { CACHE } from "@/lib/utils/cache";
import {
  fetchTokenMetadata,
  parseTokenId,
  resolveImageUrl,
} from "@/lib/launchpad/collection";

/**
 * Public artwork proxy.
 *
 * Callers only see `/api/launchpad/image/1.png`. The original Pinata URL is
 * resolved server-side from that token's metadata, so the IPFS directory and
 * its file list are never handed to the client or marketplace.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId: rawTokenId } = await params;
  const tokenId = parseTokenId(rawTokenId);

  if (!tokenId) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const metadata = await fetchTokenMetadata(tokenId);
    const source = resolveImageUrl(metadata.image);

    if (!source) {
      console.error(
        `Launchpad metadata for token ${tokenId} has no usable image URI`
      );
      return new NextResponse("Artwork unavailable", { status: 502 });
    }

    const upstream = await fetch(source, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !upstream.body || !contentType.startsWith("image/")) {
      console.error(
        `Pinata artwork for token ${tokenId} returned ${upstream.status} (${contentType || "no content type"})`
      );
      return new NextResponse("Artwork unavailable", { status: 502 });
    }

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": CACHE.launchpadImage,
      "X-Content-Type-Options": "nosniff",
    };

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers["Content-Length"] = contentLength;

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error(`Error proxying launchpad artwork for token ${tokenId}:`, error);
    return new NextResponse("Artwork unavailable", { status: 502 });
  }
}
