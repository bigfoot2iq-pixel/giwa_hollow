import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "0");
    const limit = parseInt(searchParams.get("limit") || "10");
    const walletSearch = searchParams.get("wallet")?.toLowerCase().trim() || "";
    
    // Validate pagination parameters
    if (isNaN(page) || page < 0) {
      return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 });
    }
    
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Invalid limit parameter (must be between 1 and 100)" }, { status: 400 });
    }
    
    const offset = page * limit;
    
    // Prevent excessive offset values
    if (offset > 10000) {
      return NextResponse.json({ error: "Page offset too large" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    
    // Check if id is a UUID or a slug
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(id);

    // Verify raffle exists first
    let raffleQuery = supabase
      .from("litvm_raffle_raffles")
      .select("id");

    if (isUuid) {
      raffleQuery = raffleQuery.eq("id", id);
    } else {
      raffleQuery = raffleQuery.eq("slug", id.toLowerCase());
    }

    const { data: raffle, error: raffleError } = await raffleQuery.single();
    
    if (raffleError || !raffle) {
      return NextResponse.json({ error: "Raffle not found" }, { status: 404 });
    }

    // Build query with optional wallet filter
    let query = supabase
      .from("litvm_raffle_entries")
      .select("wallet_address, entry_count, tx_hash, created_at", { count: "exact" })
      .eq("raffle_id", raffle.id);
    
    // Add wallet filter if provided
    if (walletSearch) {
      query = query.ilike("wallet_address", `%${walletSearch}%`);
    }
    
    // Apply ordering and pagination
    const { data: entries, error, count } = await query
      .order("entry_count", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching entries:", error);
      return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
    }

    return NextResponse.json({
      entries: entries || [],
      total: count || 0,
      page,
      limit,
      hasMore: count ? offset + limit < count : false,
    });
  } catch (error) {
    console.error("Error in GET /api/raffles/[id]/entries:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
