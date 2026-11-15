import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  isMissingTableError,
  LAUNCHPAD_REQUESTS_MIGRATION,
  LAUNCHPAD_REQUESTS_TABLE,
} from "@/lib/supabase/errors";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json(
        { error: "That doesn't look like a request ID" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();
    // Only expose fields that are safe to show to whoever holds the reference
    // ID. Admin notes and contact details stay private to the admin dashboard.
    const { data, error, status } = await supabase
      .from("litvm_launchpad_requests")
      .select("id, collection_name, symbol, status, created_at, updated_at")
      .eq("id", id.toLowerCase())
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error, status)) {
        console.warn(
          `[launchpad] table "${LAUNCHPAD_REQUESTS_TABLE}" is missing - apply ${LAUNCHPAD_REQUESTS_MIGRATION} in the Supabase SQL editor`
        );
        return NextResponse.json(
          { error: "Request tracking is temporarily unavailable" },
          { status: 503 }
        );
      }

      console.error("Error loading launchpad request status:", error);
      return NextResponse.json(
        { error: "Failed to load the request status" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "No request found with that ID" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { request: data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error in GET /api/launchpad/requests/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
