import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUploadToken } from "@/lib/launchpad/api-auth";
import {
  IMAGE_CONTENT_TYPES,
  isImageExtension,
  MAX_IMAGE_BYTES,
} from "@/lib/launchpad/constants";
import {
  getNftBucket,
  imageKey,
  isTokenId,
  isValidVersion,
  readActiveCollection,
} from "@/lib/launchpad/storage";
import { matchesImageMagic } from "@/lib/launchpad/storage-validation";

export const dynamic = "force-dynamic";

/**
 * Streams one image into the private R2 bucket.
 *
 * The body is piped straight through the Worker to R2; only a 16-byte range
 * read is used afterwards to verify the file really is the image type its
 * extension claims.
 */
export async function POST(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const version = searchParams.get("version") || "";
  const tokenId = Number(searchParams.get("tokenId"));
  const ext = (searchParams.get("ext") || "").toLowerCase();

  if (!isValidVersion(version)) {
    return jsonError("Invalid version", 400);
  }
  if (!isTokenId(tokenId)) {
    return jsonError("Invalid token id", 400);
  }
  if (!isImageExtension(ext)) {
    return jsonError("Unsupported image extension", 400);
  }

  const auth = await requireUploadToken(request, version);
  if ("response" in auth) return auth.response;

  try {
    const active = await readActiveCollection();
    if (active?.version === version) {
      return jsonError("The active version cannot be modified", 409);
    }

    const declaredLength = Number(request.headers.get("content-length") || "");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
      return jsonError("Image is larger than 12 MB", 413);
    }

    const body = await request.arrayBuffer();

    if (body.byteLength === 0) {
      return jsonError("Missing image body", 400);
    }
    if (body.byteLength > MAX_IMAGE_BYTES) {
      return jsonError("Image is larger than 12 MB", 413);
    }

    // Validate before writing so an HTML/SVG file renamed to .png never
    // reaches the bucket (and never gets served as an image).
    if (!matchesImageMagic(new Uint8Array(body.slice(0, 16)), ext)) {
      return jsonError(
        `The uploaded file is not a valid ${ext.toUpperCase()} image`,
        400
      );
    }

    const bucket = await getNftBucket();
    const key = imageKey(version, tokenId, ext);
    const sha256Header = request.headers.get("x-file-sha256")?.trim() || "";
    const sha256 = /^[a-f0-9]{64}$/i.test(sha256Header)
      ? sha256Header.toLowerCase()
      : undefined;

    // R2 in the Workers runtime requires a known-length body, so the image is
    // buffered (max 12 MB) rather than streamed.
    const object = await bucket.put(key, body, {
      httpMetadata: {
        contentType: IMAGE_CONTENT_TYPES[ext],
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        tokenId: String(tokenId),
        ...(sha256 ? { sha256 } : {}),
      },
    });

    if (!object) {
      return jsonError("R2 did not store the image", 500);
    }

    return NextResponse.json(
      {
        ok: true,
        key,
        tokenId,
        ext,
        bytes: object.size,
        etag: object.etag,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error uploading launchpad image:", error);
    return jsonError(
      error instanceof Error ? error.message : "Could not store the image",
      500
    );
  }
}
