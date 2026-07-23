import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdminSignature } from "@/lib/utils/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("litvm_raffle_config")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      console.error("Error fetching config:", error);
      return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json({ key, value: data.value });
  } catch (error) {
    console.error("Error in GET /api/config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSignature(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { key, value } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json({ error: "Key and value are required" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("litvm_raffle_config")
      .upsert(
        { key, value: String(value), updated_at: new Date().toISOString() },
        { onConflict: "key" }
      )
      .select()
      .single();

    if (error) {
      console.error("Error updating config:", error);
      return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
    }

    return NextResponse.json({ key, value: data.value });
  } catch (error) {
    console.error("Error in POST /api/config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
