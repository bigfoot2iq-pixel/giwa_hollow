import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/launchpad/api-auth";
import {
  IMAGE_CONTENT_TYPES,
  LAUNCHPAD_ART_SUPPLY,
  LAUNCHPAD_COLLECTION,
} from "@/lib/launchpad/constants";
import {
  getNftBucket,
  imagePrefix,
  isValidVersion,
  listImageObjects,
  listMetadataObjects,
  manifestKey,
  metadataPrefix,
  parseImageObjectName,
  parseMetadataObjectName,
  readActiveCollection,
  readCollectionRecord,
  sha256Hex,
  writeCollectionRecord,
  type NftObject,
} from "@/lib/launchpad/storage";
import type {
  CollectionRecord,
  FinalizeReport,
  ImageExtension,
  ManifestFile,
  VersionManifest,
} from "@/lib/launchpad/storage-types";

export const dynamic = "force-dynamic";

function firstMissing(ids: number[], limit = 50): number[] {
  return ids.slice(0, limit);
}

/**
 * Validates a pending version and writes its immutable receipt.
 *
 * Images and metadata are uploaded first; this step only lists the objects,
 * checks the token-id space is complete and consistent, and writes
 * manifest.json plus collection.json. It does not activate the version.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const version = body && typeof body.version === "string" ? body.version : "";

  if (!isValidVersion(version)) {
    return jsonError("Invalid version", 400);
  }

  try {
    const active = await readActiveCollection(true);
    if (active?.version === version) {
      return jsonError("That version is already active", 409);
    }

    const existing = await readCollectionRecord(version);
    if (existing) {
      return NextResponse.json(
        {
          error: "That version is already finalized",
          complete: true,
          record: existing,
        },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    const [imageObjects, metadataObjects] = await Promise.all([
      listImageObjects(version),
      listMetadataObjects(version),
    ]);

    const imageMap = new Map<
      number,
      { object: NftObject; ext: ImageExtension }
    >();

    for (const object of imageObjects) {
      const relative = object.key.slice(imagePrefix(version).length);
      const parsed = parseImageObjectName(relative);

      if (!parsed) {
        return jsonError(`Unexpected image object: ${object.key}`, 400);
      }
      if (imageMap.has(parsed.tokenId)) {
        return jsonError(`Duplicate image for token ${parsed.tokenId}`, 400);
      }

      imageMap.set(parsed.tokenId, { object, ext: parsed.ext });
    }

    const metadataMap = new Map<number, NftObject>();

    for (const object of metadataObjects) {
      const relative = object.key.slice(metadataPrefix(version).length);
      const tokenId = parseMetadataObjectName(relative);

      if (!tokenId) {
        return jsonError(`Unexpected metadata object: ${object.key}`, 400);
      }
      if (metadataMap.has(tokenId)) {
        return jsonError(`Duplicate metadata for token ${tokenId}`, 400);
      }

      metadataMap.set(tokenId, object);
    }

    const extensions = new Set(
      [...imageMap.values()].map((entry) => entry.ext)
    );

    if (extensions.size === 0) {
      return jsonError("No images were uploaded for this version", 400);
    }
    if (extensions.size > 1) {
      return jsonError(
        `All images must use one format. Found: ${[...extensions].join(", ")}`,
        400
      );
    }

    const imageExtension = [...extensions][0];
    const missingImages: number[] = [];
    const missingMetadata: number[] = [];

    for (let tokenId = 1; tokenId <= LAUNCHPAD_ART_SUPPLY; tokenId += 1) {
      if (!imageMap.has(tokenId)) missingImages.push(tokenId);
      if (!metadataMap.has(tokenId)) missingMetadata.push(tokenId);
    }

    if (missingImages.length > 0 || missingMetadata.length > 0) {
      return jsonError(
        `Collection is incomplete: ${imageMap.size}/${LAUNCHPAD_ART_SUPPLY} images, ${metadataMap.size}/${LAUNCHPAD_ART_SUPPLY} metadata files`,
        400,
        {
          missingImages: firstMissing(missingImages),
          missingImagesCount: missingImages.length,
          missingMetadata: firstMissing(missingMetadata),
          missingMetadataCount: missingMetadata.length,
        }
      );
    }

    const files: ManifestFile[] = [];
    let totalBytes = 0;

    for (let tokenId = 1; tokenId <= LAUNCHPAD_ART_SUPPLY; tokenId += 1) {
      const image = imageMap.get(tokenId);
      const metadata = metadataMap.get(tokenId);

      if (!image || !metadata) {
        // The completeness check above guarantees this cannot happen.
        return jsonError(`Missing files for token ${tokenId}`, 500);
      }

      totalBytes += image.object.size + metadata.size;

      files.push({
        tokenId,
        image: {
          key: image.object.key,
          bytes: image.object.size,
          contentType: IMAGE_CONTENT_TYPES[image.ext],
          etag: image.object.httpEtag || image.object.etag,
        },
        metadata: {
          key: metadata.key,
          bytes: metadata.size,
          contentType: "application/json; charset=utf-8",
          etag: metadata.httpEtag || metadata.etag,
        },
      });
    }

    const contentHash = await sha256Hex(
      files
        .map(
          (file) =>
            `${file.tokenId}:${file.image.etag || ""}:${file.metadata.etag || ""}`
        )
        .join("\n")
    );

    const createdAt = new Date().toISOString();

    const record: CollectionRecord = {
      schema: "ariwa-launchpad-collection/1",
      collection: LAUNCHPAD_COLLECTION,
      version,
      name:
        body && typeof body.name === "string" && body.name.trim()
          ? body.name.trim().slice(0, 120)
          : "ARIWA",
      description:
        body && typeof body.description === "string" && body.description.trim()
          ? body.description.trim().slice(0, 2000)
          : "The first collection on Giwa chain",
      supply: LAUNCHPAD_ART_SUPPLY,
      imageExtension,
      imageCount: imageMap.size,
      metadataCount: metadataMap.size,
      totalBytes,
      contentHash,
      createdAt,
      createdBy: auth.wallet,
    };

    const manifest: VersionManifest = {
      schema: "ariwa-launchpad-manifest/1",
      collection: LAUNCHPAD_COLLECTION,
      version,
      supply: LAUNCHPAD_ART_SUPPLY,
      imageExtension,
      contentHash,
      files,
      createdAt,
      createdBy: auth.wallet,
    };

    // Manifest first, collection record last: a crash in between must not
    // leave a "complete" collection without its manifest.
    const bucket = await getNftBucket();
    await bucket.put(manifestKey(version), JSON.stringify(manifest, null, 2), {
      httpMetadata: {
        contentType: "application/json; charset=utf-8",
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    await writeCollectionRecord(record);

    const report: FinalizeReport = {
      version,
      record,
      manifestKey: manifestKey(version),
      contentHash,
      imageCount: imageMap.size,
      metadataCount: metadataMap.size,
      totalBytes,
    };

    return NextResponse.json(report, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error finalizing launchpad storage version:", error);
    return jsonError(
      error instanceof Error ? error.message : "Could not finalize the version",
      500
    );
  }
}
