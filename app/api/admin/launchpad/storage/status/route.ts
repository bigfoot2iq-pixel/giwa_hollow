import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAdmin, requireUploadToken } from "@/lib/launchpad/api-auth";
import {
  LAUNCHPAD_ART_SUPPLY,
  LAUNCHPAD_COLLECTION,
  LEGACY_IMAGE_CID,
  LEGACY_METADATA_CID,
  LEGACY_PINATA_GATEWAY,
} from "@/lib/launchpad/constants";
import {
  compareVersions,
  imagePrefix,
  listImageObjects,
  listMetadataObjects,
  listVersionNames,
  metadataPrefix,
  parseImageObjectName,
  parseMetadataObjectName,
  readActiveCollection,
  readCollectionRecord,
} from "@/lib/launchpad/storage";
import type {
  StorageStatusResponse,
  VersionSummary,
} from "@/lib/launchpad/storage-types";

export const dynamic = "force-dynamic";

async function authorize(request: NextRequest): Promise<boolean> {
  const token = await requireUploadToken(request);
  if (!("response" in token)) return true;

  const admin = await requireAdmin(request);
  return !("response" in admin);
}

/**
 * Admin status: active version, version history and pending upload counts.
 *
 * Incomplete versions are inspected through R2 list calls so the UI can
 * resume a dropped upload without re-reading every object.
 */
export async function GET(request: NextRequest) {
  if (!(await authorize(request))) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const active = await readActiveCollection(true);
    const versions = await listVersionNames();
    const summaries: VersionSummary[] = [];

    for (const version of versions) {
      const record = await readCollectionRecord(version);

      if (record) {
        summaries.push({
          version,
          complete: true,
          active: active?.version === version,
          imageCount: record.imageCount,
          metadataCount: record.metadataCount,
          totalBytes: record.totalBytes,
          record,
        });
        continue;
      }

      const [images, metadata] = await Promise.all([
        listImageObjects(version),
        listMetadataObjects(version),
      ]);

      const imageIds: number[] = [];
      const metadataIds: number[] = [];

      for (const object of images) {
        const relative = object.key.slice(imagePrefix(version).length);
        const parsed = parseImageObjectName(relative);
        if (parsed) imageIds.push(parsed.tokenId);
      }

      for (const object of metadata) {
        const relative = object.key.slice(metadataPrefix(version).length);
        const tokenId = parseMetadataObjectName(relative);
        if (tokenId) metadataIds.push(tokenId);
      }

      imageIds.sort((a, b) => a - b);
      metadataIds.sort((a, b) => a - b);

      summaries.push({
        version,
        complete: false,
        active: false,
        imageCount: imageIds.length,
        metadataCount: metadataIds.length,
        totalBytes:
          images.reduce((total, object) => total + object.size, 0) +
          metadata.reduce((total, object) => total + object.size, 0),
        imageIds,
        metadataIds,
      });
    }

    summaries.sort((a, b) => compareVersions(a.version, b.version));

    const pending =
      [...summaries].reverse().find((summary) => !summary.complete) || null;

    // Only the pending version needs its full id list for resume; stripping
    // the others keeps the response small.
    for (const summary of summaries) {
      if (
        !summary.complete &&
        summary.version !== pending?.version
      ) {
        delete summary.imageIds;
        delete summary.metadataIds;
      }
    }

    const response: StorageStatusResponse = {
      supply: LAUNCHPAD_ART_SUPPLY,
      collection: LAUNCHPAD_COLLECTION,
      active,
      versions: summaries,
      pending,
      legacy: {
        metadataCid: LEGACY_METADATA_CID,
        imageCid: LEGACY_IMAGE_CID,
        gateway: LEGACY_PINATA_GATEWAY,
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error loading launchpad storage status:", error);
    return jsonError(
      error instanceof Error ? error.message : "Could not load storage status",
      500
    );
  }
}
