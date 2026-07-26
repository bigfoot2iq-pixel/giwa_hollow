import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { processExpiredRaffles } from "@/lib/raffles/settle";
import { reconcileOpenRaffles } from "@/lib/raffles/sync-entries";

// This route sends on-chain transactions; never cache it and give it room to
// wait on a few tx receipts within a single invocation.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if not configured

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return safeEqual(token, secret);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServiceClient();

    // Pull in wallets that joined by calling the contract directly. Doing it here
    // keeps the work off user-facing requests, which then only need the throttled
    // safety-net check. Never throws, so it can't block settlement.
    const reconciled = await reconcileOpenRaffles(supabase);

    const summary = await processExpiredRaffles(supabase);

    console.log("Cron settle-raffles run", {
      reconciled,
      activated: summary.activated.length,
      ended: summary.ended.length,
      skipped: summary.skipped.length,
      errors: summary.errors.length,
    });

    return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), reconciled, ...summary });
  } catch (error) {
    console.error("Error in POST /api/cron/settle-raffles:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
