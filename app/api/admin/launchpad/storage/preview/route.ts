import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  requireAdmin,
  requireUploadToken,
} from "@/lib/launchpad/api-auth";
import { IMAGE_CONTENT_TYPES, isImageExtension } from "@/lib/launchpad/constants";
import {
  getNftBucket,
  imageKey,
  isTokenId,
  isValidVersion,
  metadataKey,
} from "@/lib/launchpad/storage";

export const dynamic = "force-dynamic";

/**
 * Admin-only preview of a pending version. Images are returned as bytes (the
 * UI turns them into blob URLs), so nothing is exposed on the public routes
 * before activation.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const version = searchParams.get("version") || "";
  const tokenId = Number(searchParams.get("tokenId"));
  const kind = searchParams.get("kind") || "image";
  const ext = (searchParams.get("ext") || "").toLowerCase();

  if (!isValidVersion(version)) {
    return jsonError("Invalid version", 400);
  }
  if (!isTokenId(tokenId)) {
    return jsonError("Invalid token id", 400);
  }
  if (kind !== "image" && kind !== "metadata") {
    return jsonError("Invalid preview kind", 400);
  }

  let allowed = false;

  const token = await requireUploadToken(request);
  if (!("response" in token) && token.payload.version === version) {
    allowed = true;
  }

  if (!allowed) {
    const admin = await requireAdmin(request);
    if (!("response" in admin)) allowed = true;
  }

  if (!allowed) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const bucket = await getNftBucket();

    if (kind === "metadata") {
      const object = await bucket.get(metadataKey(version, tokenId));
      if (!object) return jsonError("Metadata not found", 404);

      return NextResponse.json(await object.json(), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (!isImageExtension(ext)) {
      return jsonError("Pass the pending image extension", 400);
    }

    const object = await bucket.get(imageKey(version, tokenId, ext));
    if (!object) return jsonError("Image not found", 404);

    const contentType = IMAGE_CONTENT_TYPES[ext];

    return new NextResponse(object.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(object.size),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error previewing launchpad storage version:", error);
    return jsonError(
      error instanceof Error ? error.message : "Could not load the preview",
      500
    );
  }
}
