import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  isMissingTableError,
  LAUNCHPAD_REQUESTS_MIGRATION,
  LAUNCHPAD_REQUESTS_TABLE,
} from "@/lib/supabase/errors";
import { verifyAdminSignature } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  status: z
    .enum(["pending", "reviewing", "approved", "rejected", "launched"])
    .optional(),
  admin_notes: z.string().trim().max(4000).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminSignature(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    ) {
      return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
    }

    const body = await request.json();
    const validation = updateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error.issues },
        { status: 400 }
      );
    }

    if (
      validation.data.status === undefined &&
      validation.data.admin_notes === undefined
    ) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();
    const { data, error, status } = await supabase
      .from("litvm_launchpad_requests")
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (isMissingTableError(error, status)) {
        console.warn(
          `[launchpad] table "${LAUNCHPAD_REQUESTS_TABLE}" is missing - apply ${LAUNCHPAD_REQUESTS_MIGRATION} in the Supabase SQL editor`
        );
        return NextResponse.json(
          {
            error: `Launch requests are not set up yet. Apply ${LAUNCHPAD_REQUESTS_MIGRATION} in the Supabase SQL editor, then retry.`,
            setupRequired: true,
          },
          { status: 503 }
        );
      }

      console.error("Error updating launchpad request:", error);
      return NextResponse.json(
        { error: "Failed to update launchpad request" },
        { status: 500 }
      );
    }

    return NextResponse.json({ request: data });
  } catch (error) {
    console.error("Error in PATCH /api/admin/launchpad/requests/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
