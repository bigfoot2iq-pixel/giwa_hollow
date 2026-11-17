import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/launchpad/api-auth";
import {
  LAUNCHPAD_ART_SUPPLY,
  LAUNCHPAD_COLLECTION,
} from "@/lib/launchpad/constants";
import {
  isValidVersion,
  readActiveCollection,
  readCollectionRecord,
  writeActiveCollection,
} from "@/lib/launchpad/storage";
import type { ActiveCollection } from "@/lib/launchpad/storage-types";

export const dynamic = "force-dynamic";

/**
 * Activates a finalized version, or rolls back to an older one.
 *
 * This only flips the private `launchpad/active.json` pointer. The public
 * metadata route picks it up within its short cache window; image URLs carry
 * `?v=<version>`, so their long-lived cache entries are naturally distinct.
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
    const record = await readCollectionRecord(version);
    if (!record) {
      return jsonError(
        "That version has not been finalized yet. Publish it first.",
        400
      );
    }

    if (
      record.supply !== LAUNCHPAD_ART_SUPPLY ||
      record.imageCount !== record.supply ||
      record.metadataCount !== record.supply
    ) {
      return jsonError(
        `Version ${version} is incomplete: ${record.imageCount}/${record.supply} images, ${record.metadataCount}/${record.supply} metadata files`,
        400
      );
    }

    const current = await readActiveCollection(true);
    if (current?.version === version) {
      return NextResponse.json(
        { active: current, unchanged: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const active: ActiveCollection = {
      schema: "ariwa-launchpad-active/1",
      collection: LAUNCHPAD_COLLECTION,
      version,
      supply: record.supply,
      imageExtension: record.imageExtension,
      activatedAt: new Date().toISOString(),
      activatedBy: auth.wallet,
      previousVersion: current?.version ?? null,
    };

    await writeActiveCollection(active);

    return NextResponse.json(
      { active },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error activating launchpad storage version:", error);
    return jsonError(
      error instanceof Error ? error.message : "Could not activate the version",
      500
    );
  }
}
