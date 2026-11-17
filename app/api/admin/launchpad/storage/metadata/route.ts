import { NextRequest, NextResponse } from "next/server";
import { appOrigin, jsonError, requireUploadToken } from "@/lib/launchpad/api-auth";
import { isImageExtension } from "@/lib/launchpad/constants";
import {
  getNftBucket,
  isTokenId,
  isValidVersion,
  metadataKey,
  publicImageUrl,
  readActiveCollection,
} from "@/lib/launchpad/storage";
import {
  MetadataValidationError,
  normalizeMetadata,
} from "@/lib/launchpad/storage-validation";

export const dynamic = "force-dynamic";

const MAX_BATCH_SIZE = 25;
const MAX_METADATA_BYTES = 100 * 1024;

interface MetadataItem {
  tokenId?: unknown;
  metadata?: unknown;
}

/**
 * Writes a batch of token metadata JSON files.
 *
 * The client sends small batches so one Worker invocation never fans out into
 * thousands of R2 writes. Each object is validated and its `image` field is
 * replaced with the public proxy URL for the pending version.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const version =
    body && typeof body.version === "string" ? body.version : "";
  const imageExtension =
    body && typeof body.imageExtension === "string"
      ? body.imageExtension.toLowerCase()
      : "";

  if (!isValidVersion(version)) {
    return jsonError("Invalid version", 400);
  }
  if (!isImageExtension(imageExtension)) {
    return jsonError("Invalid image extension", 400);
  }

  const auth = await requireUploadToken(request, version);
  if ("response" in auth) return auth.response;

  const items: MetadataItem[] =
    body && Array.isArray(body.items) ? body.items : [];

  if (items.length === 0 || items.length > MAX_BATCH_SIZE) {
    return jsonError(
      `Send between 1 and ${MAX_BATCH_SIZE} metadata items per batch`,
      400
    );
  }

  try {
    const active = await readActiveCollection();
    if (active?.version === version) {
      return jsonError("The active version cannot be modified", 409);
    }

    const bucket = await getNftBucket();
    const origin = appOrigin(request);
    const results: Array<{
      tokenId: number;
      ok: boolean;
      error?: string;
    }> = [];

    for (const item of items) {
      const tokenId = Number(item.tokenId);

      if (!isTokenId(tokenId)) {
        results.push({ tokenId, ok: false, error: "Invalid token id" });
        continue;
      }

      try {
        const image = publicImageUrl(
          origin,
          tokenId,
          imageExtension,
          version
       );
        const normalized = normalizeMetadata(item.metadata, tokenId, image);
        const json = JSON.stringify(normalized, null, 2);

        if (new TextEncoder().encode(json).byteLength > MAX_METADATA_BYTES) {
          results.push({
            tokenId,
            ok: false,
            error: "Metadata is larger than 100 KB",
          });
          continue;
        }

        await bucket.put(metadataKey(version, tokenId), json, {
          httpMetadata: {
            contentType: "application/json; charset=utf-8",
            cacheControl: "public, max-age=31536000, immutable",
          },
          customMetadata: { tokenId: String(tokenId) },
        });

        results.push({ tokenId, ok: true });
      } catch (error) {
        results.push({
          tokenId,
          ok: false,
          error:
            error instanceof MetadataValidationError
              ? error.message
              : "Could not write this metadata file",
        });
      }
    }

    return NextResponse.json(
      {
        results,
        written: results.filter((result) => result.ok).length,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error writing launchpad metadata batch:", error);
    return jsonError(
      error instanceof Error ? error.message : "Could not store metadata",
      500
    );
  }
}
