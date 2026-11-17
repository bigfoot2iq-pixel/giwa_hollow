import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/launchpad/api-auth";
import {
  deleteVersionObjects,
  isValidVersion,
  readActiveCollection,
} from "@/lib/launchpad/storage";

export const dynamic = "force-dynamic";

/**
 * Deletes a non-active version and every object under its prefix. Used to
 * discard an abandoned upload or trim old versions after a rollback window.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;

  const version = request.nextUrl.searchParams.get("version") || "";

  if (!isValidVersion(version)) {
    return jsonError("Invalid version", 400);
  }

  try {
    const active = await readActiveCollection(true);
    if (active?.version === version) {
      return jsonError("The active version cannot be deleted", 409);
    }

    const deleted = await deleteVersionObjects(version);

    return NextResponse.json(
      { version, deleted },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error deleting launchpad storage version:", error);
    return jsonError(
      error instanceof Error ? error.message : "Could not delete the version",
      500
    );
  }
}
