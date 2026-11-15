import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  isMissingTableError,
  LAUNCHPAD_REQUESTS_MIGRATION,
  LAUNCHPAD_REQUESTS_TABLE,
} from "@/lib/supabase/errors";
import { verifyAdminSignature } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

const STATUSES = [
  "pending",
  "reviewing",
  "approved",
  "rejected",
  "launched",
] as const;

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSignature(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || 100, 1),
      200
    );

    const supabase = await createServiceClient();
    let query = supabase
      .from("litvm_launchpad_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && STATUSES.includes(status as (typeof STATUSES)[number])) {
      query = query.eq("status", status);
    }

    const { data, error, status: responseStatus } = await query;

    if (error) {
      // A missing table means the launchpad migration was never applied. Keep
      // the admin page usable and let the UI point at the migration instead of
      // failing every poll with a 500.
      if (isMissingTableError(error, responseStatus)) {
        console.warn(
          `[launchpad] table "${LAUNCHPAD_REQUESTS_TABLE}" is missing - apply ${LAUNCHPAD_REQUESTS_MIGRATION} in the Supabase SQL editor`
        );
        return NextResponse.json(
          {
            requests: [],
            setupRequired: true,
            migration: LAUNCHPAD_REQUESTS_MIGRATION,
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }

      console.error("Error loading launchpad requests:", error);
      return NextResponse.json(
        { error: "Failed to load launchpad requests" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { requests: data || [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error in GET /api/admin/launchpad/requests:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
