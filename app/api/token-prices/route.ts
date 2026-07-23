import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const addresses = searchParams.get("token_addresses");

  if (!addresses) {
    return NextResponse.json({ error: "token_addresses required" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.katana.network/v1/tokens/prices?token_addresses=${addresses}&chain_id=747474&include_24hr_change=true`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Price fetch failed" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
}
