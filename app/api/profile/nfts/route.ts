import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { giwaSepolia, LAUNCHPAD_NFT_ADDRESS } from "@/lib/contracts";
import { CACHE } from "@/lib/utils/cache";

/**
 * The profile's ARIWA NFT shelf.
 *
 * The collection is ERC721A, so it has no `tokenOfOwnerByIndex`: finding a
 * wallet's tokens on-chain would mean scanning `ownerOf` across the whole
 * supply. GIWA's Blockscout index already knows the answer, and the app uses
 * the same explorer for its holder table. This route keeps that dependency
 * server-side (no CORS surprises), adds a short per-instance cache, and hands
 * the client a small, stable shape.
 */

const EXPLORER_BASE = (
  process.env.NEXT_PUBLIC_EXPLORER_URL ||
  giwaSepolia.blockExplorers?.default.url ||
  "https://sepolia-explorer.giwa.io"
).replace(/\/$/, "");

const CONTRACT_ADDRESS = LAUNCHPAD_NFT_ADDRESS;

// Blockscout serves 50 instances per page. A holder can only ever own 2,222
// pieces, but walking more than a few pages is already pathological for a
// personal profile — the first 250 are plenty and keep the route bounded.
const MAX_PAGES = 5;
const EXPLORER_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 10_000;
const MAX_CACHE_ENTRIES = 1_000;

interface ExplorerInstance {
  id?: string;
  token_type?: string;
  token?: {
    address_hash?: string;
    name?: string | null;
    symbol?: string | null;
  };
}

interface ExplorerInstancesPage {
  items?: ExplorerInstance[];
  next_page_params?: Record<string, string | number> | null;
}

interface ProfileNft {
  id: number;
  name: string;
  image: string;
}

interface ProfileNftsPayload {
  nfts: ProfileNft[];
  count: number;
  contract: string;
}

interface CachedPayload {
  payload: ProfileNftsPayload;
  fetchedAt: number;
}

const cache = new Map<string, CachedPayload>();

function readCache(key: string): ProfileNftsPayload | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.payload;
}

function writeCache(key: string, payload: ProfileNftsPayload) {
  cache.set(key, { payload, fetchedAt: Date.now() });
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

function isSameCollection(instance: ExplorerInstance, contract: string) {
  const address = instance.token?.address_hash;
  return (
    typeof address === "string" &&
    address.toLowerCase() === contract.toLowerCase()
  );
}

async function fetchOwnedInstances(
  wallet: string,
  contract: string,
): Promise<ProfileNftsPayload> {
  const ids = new Set<number>();
  let cursor: Record<string, string | number> | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      holder_address_hash: wallet,
    });

    if (cursor) {
      for (const [key, value] of Object.entries(cursor)) {
        params.set(key, String(value));
      }
    }

    const url = `${EXPLORER_BASE}/api/v2/tokens/${contract}/instances?${params.toString()}`;
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(EXPLORER_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Blockscout returns 404 for a collection it has not indexed yet (a
      // freshly deployed contract with no tokens). That is an empty shelf, not
      // an upstream failure.
      if (response.status === 404) {
        return { nfts: [], count: 0, contract };
      }
      throw new Error(`GIWA explorer returned ${response.status}`);
    }

    const data = (await response.json()) as ExplorerInstancesPage;
    const items = Array.isArray(data.items) ? data.items : [];

    for (const item of items) {
      if (!isSameCollection(item, contract)) continue;

      const tokenId = Number(item.id);
      if (!Number.isSafeInteger(tokenId) || tokenId <= 0) continue;
      ids.add(tokenId);
    }

    const nextPage = data.next_page_params;
    if (!nextPage || Object.keys(nextPage).length === 0 || items.length === 0) {
      break;
    }
    cursor = nextPage;
  }

  const sortedIds = [...ids].sort((a, b) => a - b);

  return {
    nfts: sortedIds.map((id) => ({
      id,
      name: `ARIWA #${id}`,
      image: `/api/launchpad/image/${id}.png`,
    })),
    count: sortedIds.length,
    contract,
  };
}

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet")?.trim();

  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json(
      { error: "A valid wallet address is required." },
      { status: 400 },
    );
  }

  if (!CONTRACT_ADDRESS || !isAddress(CONTRACT_ADDRESS)) {
    return NextResponse.json(
      { error: "The ARIWA collection is not configured yet." },
      { status: 503 },
    );
  }

  const cacheKey = `${wallet.toLowerCase()}:${CONTRACT_ADDRESS.toLowerCase()}`;
  const cached = readCache(cacheKey);

  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": CACHE.walletNfts },
    });
  }

  try {
    const payload = await fetchOwnedInstances(wallet, CONTRACT_ADDRESS);
    writeCache(cacheKey, payload);

    return NextResponse.json(payload, {
      headers: { "Cache-Control": CACHE.walletNfts },
    });
  } catch (error) {
    console.error("Error reading profile NFTs:", error);
    return NextResponse.json(
      { error: "The GIWA explorer could not return your collection." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
