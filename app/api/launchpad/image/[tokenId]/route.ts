import { NextRequest, NextResponse } from "next/server";
import { CACHE } from "@/lib/utils/cache";
import {
  getLegacyImageUrls,
  parseTokenId,
  resolveLaunchpadSource,
  type LaunchpadSource,
} from "@/lib/launchpad/collection";
import {
  IMAGE_CONTENT_TYPES,
  isImageExtension,
  MAX_IMAGE_BYTES,
} from "@/lib/launchpad/constants";
import type { ImageExtension } from "@/lib/launchpad/storage-types";
import {
  getNftBucket,
  imageKey,
  isValidVersion,
} from "@/lib/launchpad/storage";

export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_TYPES = new Set(Object.values(IMAGE_CONTENT_TYPES));

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

function extensionFromPath(raw: string): string | null {
  const match = /^\d+\.([a-z0-9]+)$/i.exec(raw);
  return match ? match[1].toLowerCase() : null;
}

function notFound(headOnly: boolean): NextResponse {
  return new NextResponse(headOnly ? null : "Not found", {
    status: 404,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
  });
}

function unavailable(headOnly: boolean): NextResponse {
  return new NextResponse(headOnly ? null : "Artwork unavailable", {
    status: 502,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
  });
}

async function serveFromR2(
  source: Extract<LaunchpadSource, { kind: "r2" }>,
  tokenId: number,
  rawTokenId: string,
  requestedVersion: string | null,
  headOnly: boolean
): Promise<NextResponse> {
  const version =
    requestedVersion && isValidVersion(requestedVersion)
      ? requestedVersion
      : source.active.version;

  const requestedExt = extensionFromPath(rawTokenId);
  const ext: ImageExtension =
    requestedExt && isImageExtension(requestedExt)
      ? requestedExt
      : source.active.imageExtension;

  const bucket = await getNftBucket();

  let object = await bucket.get(imageKey(version, tokenId, ext));

  // Old cached metadata may reference a different extension (for example a
  // legacy `.png` URL after a WebP upload). Use the active version's extension
  // before giving up.
  if (!object && ext !== source.active.imageExtension) {
    object = await bucket.get(
      imageKey(version, tokenId, source.active.imageExtension)
    );
  }

  // An old cached metadata document may reference a version that has since
  // been removed. Fall back to the currently active version rather than
  // breaking the image.
  if (!object && version !== source.active.version) {
    object = await bucket.get(
      imageKey(source.active.version, tokenId, source.active.imageExtension)
    );
  }

  if (!object) return notFound(headOnly);

  if (object.size > MAX_IMAGE_BYTES) {
    console.error(
      `R2 artwork for token ${tokenId} (${version}) is too large`
    );
    return unavailable(headOnly);
  }

  const storedType = object.httpMetadata?.contentType?.split(";")[0].trim().toLowerCase();
  const contentType =
    storedType && ALLOWED_IMAGE_TYPES.has(storedType)
      ? storedType
      : IMAGE_CONTENT_TYPES[ext];

  const headers: Record<string, string> = {
    ...CORS_HEADERS,
    "Content-Type": contentType,
    "Content-Length": String(object.size),
    "Cache-Control": CACHE.launchpadImage,
    "X-Content-Type-Options": "nosniff",
  };

  if (object.httpEtag || object.etag) {
    headers.ETag = object.httpEtag || object.etag;
  }

  if (headOnly) {
    return new NextResponse(null, { status: 200, headers });
  }

  return new NextResponse(object.body, { status: 200, headers });
}

async function serveFromPinata(
  tokenId: number,
  headOnly: boolean
): Promise<NextResponse> {
  // The legacy image is a single IPFS directory with `<id>.png` files. Try
  // each configured gateway in turn; Pinata's gateway rate-limits shared
  // egress, so public gateways keep the collection alive until R2 is active.
  let lastStatus = 0;

  for (const source of getLegacyImageUrls(tokenId)) {
    try {
      const upstream = await fetch(source, {
        method: headOnly ? "HEAD" : "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });

      const contentType = (upstream.headers.get("content-type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase();

      if (!upstream.ok || !ALLOWED_IMAGE_TYPES.has(contentType)) {
        lastStatus = upstream.status;
        continue;
      }

      const contentLength = upstream.headers.get("content-length");
      if (contentLength && Number(contentLength) > MAX_IMAGE_BYTES) {
        console.error(`Legacy artwork for token ${tokenId} is too large`);
        return unavailable(headOnly);
      }

      const headers: Record<string, string> = {
        ...CORS_HEADERS,
        "Content-Type": contentType,
        "Cache-Control": CACHE.launchpadImage,
        "X-Content-Type-Options": "nosniff",
      };

      if (contentLength) headers["Content-Length"] = contentLength;

      const etag = upstream.headers.get("etag");
      if (etag) headers.ETag = etag;

      if (headOnly || !upstream.body) {
        return new NextResponse(null, { status: 200, headers });
      }

      return new NextResponse(upstream.body, { status: 200, headers });
    } catch (error) {
      console.error(
        `Legacy gateway failed for token ${tokenId}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.error(
    `Legacy artwork for token ${tokenId} was unavailable from all gateways (last status ${lastStatus || "none"})`
  );
  return unavailable(headOnly);
}

async function buildImageResponse(
  request: NextRequest,
  rawTokenId: string,
  headOnly: boolean
): Promise<NextResponse> {
  const tokenId = parseTokenId(rawTokenId);
  if (!tokenId) return notFound(headOnly);

  try {
    const source = await resolveLaunchpadSource();

    if (source.kind === "r2") {
      return await serveFromR2(
        source,
        tokenId,
        rawTokenId,
        request.nextUrl.searchParams.get("v"),
        headOnly
      );
    }

    return await serveFromPinata(tokenId, headOnly);
  } catch (error) {
    console.error(
      `Error proxying launchpad artwork for token ${tokenId}:`,
      error
    );
    return unavailable(headOnly);
  }
}

/**
 * Public artwork proxy.
 *
 * Callers only see `/api/launchpad/image/1.png?v=v1`. The private R2 object
 * (or the legacy Pinata image) is resolved server-side, so the storage origin
 * is never handed to the client or marketplace.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId } = await params;
  return buildImageResponse(request, tokenId, false);
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId } = await params;
  return buildImageResponse(request, tokenId, true);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
