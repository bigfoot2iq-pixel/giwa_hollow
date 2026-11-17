import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/launchpad/api-auth";
import { LAUNCHPAD_ART_SUPPLY } from "@/lib/launchpad/constants";
import {
  getNftBucket,
  isValidVersion,
  listTokenIds,
  listVersionNames,
  nextVersionName,
  readActiveCollection,
  readCollectionRecord,
} from "@/lib/launchpad/storage";
import { createUploadToken } from "@/lib/launchpad/upload-token";
import type { UploadSessionResponse } from "@/lib/launchpad/storage-types";

export const dynamic = "force-dynamic";

/**
 * Starts (or resumes) one admin upload session.
 *
 * The admin wallet signature is verified once here; the resulting HMAC token
 * authenticates the 2,222 image uploads and the metadata batches without a
 * Supabase lookup per file.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const requestedVersion =
      body && typeof body.version === "string" ? body.version : undefined;
    const forceNewVersion = body?.newVersion === true;

    // Fail fast if the binding is missing or misconfigured.
    await getNftBucket();

    const active = await readActiveCollection(true);

    let version: string;
    let uploadedImageIds: number[] = [];
    let uploadedMetadataIds: number[] = [];

    if (requestedVersion) {
      if (!isValidVersion(requestedVersion)) {
        return jsonError("Invalid version. Expected v1, v2, ...", 400);
      }

      if (active?.version === requestedVersion) {
        return jsonError("That version is already active", 409);
      }

      const record = await readCollectionRecord(requestedVersion);
      if (record) {
        return NextResponse.json(
          {
            error:
              "That version is already finalized. Activate it from the version history.",
            complete: true,
            record,
          },
          { status: 409, headers: { "Cache-Control": "no-store" } }
        );
      }

      version = requestedVersion;
      [uploadedImageIds, uploadedMetadataIds] = await Promise.all([
        listTokenIds(version, "images"),
        listTokenIds(version, "metadata"),
      ]);
    } else {
      const versions = await listVersionNames();
      const pending = versions.at(-1);

      if (pending && !forceNewVersion) {
        const record = await readCollectionRecord(pending);
        if (!record) {
          // Resume the newest incomplete version rather than piling up v3/v4.
          version = pending;
          [uploadedImageIds, uploadedMetadataIds] = await Promise.all([
            listTokenIds(version, "images"),
            listTokenIds(version, "metadata"),
          ]);
        } else {
          version = await nextVersionName();
        }
      } else {
        version = await nextVersionName();
      }
    }

    const { token, expiresAt } = await createUploadToken({
      version,
      wallet: auth.wallet,
    });

    const response: UploadSessionResponse = {
      version,
      token,
      expiresAt,
      supply: LAUNCHPAD_ART_SUPPLY,
      active,
      uploadedImageIds,
      uploadedMetadataIds,
      complete: false,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error creating launchpad storage session:", error);
    return jsonError(
      error instanceof Error ? error.message : "Could not start the upload",
      500
    );
  }
}
