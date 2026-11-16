import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { CACHE } from "@/lib/utils/cache";

const MAX_TOKENS = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawAddresses = searchParams.get("token_addresses");

  if (!rawAddresses) {
    return NextResponse.json({ error: "token_addresses required" }, { status: 400 });
  }

  // This route is a thin proxy to an upstream price API. Validate the parameter
  // instead of forwarding it verbatim, so `&chain_id=` / `&extra=` cannot be
  // injected and a caller cannot fan out to unbounded addresses.
  const addresses = rawAddresses
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (addresses.length === 0 || addresses.length > MAX_TOKENS) {
    return NextResponse.json(
      { error: `Provide between 1 and ${MAX_TOKENS} addresses` },
      { status: 400 }
    );
  }

  if (!addresses.every((address) => isAddress(address, { strict: false }))) {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      token_addresses: addresses.join(","),
      chain_id: "747474",
      include_24hr_change: "true",
    });
    const res = await fetch(
      `https://api.katana.network/v1/tokens/prices?${params.toString()}`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Price fetch failed" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, { headers: { "Cache-Control": CACHE.tokenPrices } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
}
