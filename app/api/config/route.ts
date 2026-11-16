import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdminSignature } from "@/lib/utils/auth";
import { CACHE } from "@/lib/utils/cache";
import {
  HOLDER_REQUIREMENTS_CONFIG_KEY,
  RAFFLES_MAINTENANCE_CONFIG_KEY,
} from "@/lib/launchpad/config";

// The config table is a generic key/value store. Only these keys are safe to
// expose without an admin signature; an allowlist means a future secret can
// never leak just because it was stored under the same table.
const PUBLIC_CONFIG_KEYS = new Set<string>([
  HOLDER_REQUIREMENTS_CONFIG_KEY,
  RAFFLES_MAINTENANCE_CONFIG_KEY,
]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    if (!PUBLIC_CONFIG_KEYS.has(key)) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
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

    return NextResponse.json(
      { key, value: data.value },
      { headers: { "Cache-Control": CACHE.config } }
    );
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

    if (typeof key !== "string" || key.length === 0 || key.length > 64) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    if (!/^[a-z0-9_]+$/.test(key)) {
      return NextResponse.json({ error: "Invalid key format" }, { status: 400 });
    }

    if (value === undefined || value === null) {
      return NextResponse.json({ error: "Key and value are required" }, { status: 400 });
    }

    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (serialized.length > 20_000) {
      return NextResponse.json({ error: "Value is too large" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("litvm_raffle_config")
      .upsert(
        { key, value: serialized, updated_at: new Date().toISOString() },
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
