import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdminSignature } from "@/lib/utils/auth";
import { getOnChainRaffleState } from "@/lib/utils/chain";
import { z } from "zod";

const updateRaffleSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  image_url: z.string().url().optional().nullable(),
  tokens_required: z.number().positive().optional(),
  max_entries_per_user: z.number().positive().optional(),
  max_participants: z.number().positive().optional(),
  start_date: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid datetime" })
    .optional(),
  end_date: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid datetime" })
    .optional(),
  chain_raffle_id: z.number().optional(),
  tx_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
});

type UpdateRaffleData = {
  title?: string;
  description?: string;
  image_url?: string | null;
  tokens_required?: number;
  max_entries_per_user?: number;
  max_participants?: number;
  start_date?: string;
  end_date?: string;
  chain_raffle_id?: number;
  tx_hash?: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminSignature(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createServiceClient();

    // Check if id is a UUID or a slug
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(id);

    let query = supabase
      .from("litvm_raffle_raffles")
      .select("*");

    if (isUuid) {
      query = query.eq("id", id);
    } else {
      query = query.eq("slug", id.toLowerCase());
    }

    const { data: raffle, error } = await query.single();

    if (error || !raffle) {
      return NextResponse.json({ error: "Raffle not found" }, { status: 404 });
    }

    // Get entries
    const { data: entries } = await supabase
      .from("litvm_raffle_entries")
      .select("*")
      .eq("raffle_id", raffle.id)
      .order("created_at", { ascending: false });

    // Get winners
    const { data: winners } = await supabase
      .from("litvm_raffle_winners")
      .select("*")
      .eq("raffle_id", raffle.id);

    const { data: prizes } = await supabase
      .from("litvm_raffle_prizes")
      .select("*")
      .eq("raffle_id", raffle.id)
      .order("created_at", { ascending: true });

    // Read on-chain state
    let chainStatus = undefined;
    if (raffle.chain_raffle_id) {
      try {
        chainStatus = await getOnChainRaffleState(raffle.chain_raffle_id);
      } catch (err) {
        console.error("Error reading on-chain state:", err);
      }
    }

    return NextResponse.json({ raffle, entries, winners, prizes, chainStatus });
  } catch (error) {
    console.error("Error in GET /api/admin/raffles/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminSignature(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = updateRaffleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();
    const updateData: UpdateRaffleData = validation.data;

    const { data: raffle, error } = await supabase
      .from("litvm_raffle_raffles")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating raffle:", error);
      return NextResponse.json({ error: "Failed to update raffle" }, { status: 500 });
    }

    // Log admin action
    const adminWallet = request.headers.get("x-admin-wallet") || "unknown";
    await supabase.from("litvm_raffle_admin_logs").insert({
      admin_wallet: adminWallet,
      action: "update_raffle",
      details: { raffle_id: id, updates: validation.data },
    });

    return NextResponse.json({ raffle });
  } catch (error) {
    console.error("Error in PUT /api/admin/raffles/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminSignature(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createServiceClient();

    // Only allow deletion of raffles that have not started
    const { data: raffle } = await supabase
      .from("litvm_raffle_raffles")
      .select("start_date")
      .eq("id", id)
      .single();

    if (!raffle) {
      return NextResponse.json({ error: "Raffle not found" }, { status: 404 });
    }

    if (new Date(raffle.start_date) <= new Date()) {
      return NextResponse.json(
        { error: "Can only delete raffles that have not started" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("litvm_raffle_raffles")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting raffle:", error);
      return NextResponse.json({ error: "Failed to delete raffle" }, { status: 500 });
    }

    // Log admin action
    const adminWallet = request.headers.get("x-admin-wallet") || "unknown";
    await supabase.from("litvm_raffle_admin_logs").insert({
      admin_wallet: adminWallet,
      action: "delete_raffle",
      details: { raffle_id: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/admin/raffles/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
