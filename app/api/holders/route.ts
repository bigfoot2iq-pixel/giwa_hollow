import { NextRequest, NextResponse } from 'next/server';
import { formatUnits } from 'viem';
import { giwaSepolia } from '@/lib/contracts/config';
import { CACHE } from '@/lib/utils/cache';

// GIWA Sepolia explorer is Blockscout, which exposes a native token
// holders endpoint — no need to replay transfer events like the old Etherscan
// flow. Blockscout v2 REST is keyless.
const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_EXPLORER_URL ||
  giwaSepolia.blockExplorers?.default?.url ||
  'https://sepolia-explorer.giwa.io';

const ARIWA_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS as string;
const HOLDERS_PER_PAGE = 50;

// Hard bound on the cursor walk, and therefore on how deep the holder list can
// be paged: reaching page N costs N sequential explorer round trips, since the
// cursor is opaque and cannot be skipped. Measured at ~0.4s per page, so 20
// pages is the most that fits inside `maxDuration` with margin. This is a "top
// holders" table — the token has tens of thousands of holders and nobody
// scrolls to #1000 — so the cap costs nothing anyone looks at. Raising it
// raises the worst-case duration linearly.
const MAX_CURSOR_PAGES = 20;

const CACHE_TTL_MS = 60_000; // 60 seconds

// The walk is bounded above, but a slow explorer still must not hold the
// function open to the platform ceiling.
export const maxDuration = 15;

interface CachedHolders {
  sorted: { address: string; nameTag: string; balance: bigint }[];
  totalSupply: bigint;
  decimals: number;
  totalHolders: number;
  exhausted: boolean;
}

// In-memory cache keyed by contract address + walk depth. Only a per-instance
// fast path: on Fluid each instance has its own copy, so the response
// Cache-Control header is what actually keeps this route off the CPU bill.
const cache = new Map<string, { data: CachedHolders; timestamp: number }>();

interface Holder {
  rank: number;
  address: string;
  nameTag: string;
  quantity: string;
  quantityRaw: string;
  percentage: string;
}

interface TokenHoldersResponse {
  holders: Holder[];
  totalHolders: number;
  totalPages: number;
  currentPage: number;
  hasMore: boolean;
}

// ── Blockscout v2 response shapes ───────────────────────────────────────────
interface BlockscoutHolder {
  address: { hash: string; name: string | null };
  value: string; // raw balance
  token_id: string | null;
}

interface BlockscoutHoldersResponse {
  items: BlockscoutHolder[];
  next_page_params: Record<string, string | number> | null;
}

interface BlockscoutTokenInfo {
  decimals: string | null;
  total_supply: string | null;
  holders_count: string | null;
}

// Walk the holders cursor only as deep as the requested page needs.
//
// This used to walk to exhaustion (up to MAX_CURSOR_PAGES sequential explorer
// round trips) on every cold instance, to build a full list that the UI then
// only ever read the first slice of. Page 1 — which is what virtually every
// request asks for — now costs a single fetch.
//
// Blockscout returns holders sorted by balance descending, so a prefix of the
// cursor walk is exactly the top-N; nothing later in the walk can belong on an
// earlier page. `exhausted` reports whether the cursor ran out, which is what
// tells us there is no further page when the explorer gives no holders_count.
async function fetchHoldersUpTo(
  contractAddress: string,
  minItems: number
): Promise<{ items: BlockscoutHolder[]; exhausted: boolean }> {
  const all: BlockscoutHolder[] = [];
  let params: Record<string, string | number> | null = null;
  let exhausted = false;

  for (let i = 0; i < MAX_CURSOR_PAGES; i++) {
    const qs = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)])
        ).toString()
      : '';
    const url = `${EXPLORER_BASE}/api/v2/tokens/${contractAddress}/holders${qs}`;

    const response = await fetch(url);
    if (!response.ok) break;

    const data: BlockscoutHoldersResponse = await response.json();
    if (!Array.isArray(data.items)) break;

    all.push(...data.items);

    if (!data.next_page_params) {
      exhausted = true;
      break;
    }
    // Stop once the requested page is covered. Compared against the unfiltered
    // length so a zero-balance holder can only ever cause one extra fetch.
    if (all.length >= minItems) break;
    params = data.next_page_params;
  }

  return { items: all, exhausted };
}

// Token metadata gives the authoritative total supply, decimals and holder
// count — the last of which means we no longer need the full walk just to know
// how many holders exist.
async function fetchTokenInfo(
  contractAddress: string
): Promise<{ totalSupply: bigint; decimals: number; holdersCount: number | null }> {
  try {
    const response = await fetch(`${EXPLORER_BASE}/api/v2/tokens/${contractAddress}`);
    if (!response.ok) return { totalSupply: 0n, decimals: 18, holdersCount: null };
    const data: BlockscoutTokenInfo = await response.json();
    const holdersCount = data.holders_count ? parseInt(data.holders_count, 10) : NaN;
    return {
      totalSupply: data.total_supply ? BigInt(data.total_supply) : 0n,
      decimals: data.decimals ? parseInt(data.decimals, 10) : 18,
      holdersCount: Number.isFinite(holdersCount) ? holdersCount : null,
    };
  } catch {
    return { totalSupply: 0n, decimals: 18, holdersCount: null };
  }
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<TokenHoldersResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url);
    const contractAddress = searchParams.get('address') || ARIWA_TOKEN_ADDRESS;
    const pageParam = searchParams.get('page');

    if (!contractAddress) {
      return NextResponse.json(
        { error: 'Missing token address (and NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS env var is not set)' },
        { status: 400 }
      );
    }

    const page = pageParam ? parseInt(pageParam, 10) : 1;
    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        { error: 'Invalid page number. Must be a positive integer.' },
        { status: 400 }
      );
    }

    // Cache key includes the walk depth: a page-1 walk cannot serve page 3.
    const needed = page * HOLDERS_PER_PAGE;
    const cacheKey = `${contractAddress.toLowerCase()}:${page}`;
    const cached = cache.get(cacheKey);
    let data: CachedHolders;

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      data = cached.data;
    } else {
      const [walk, tokenInfo] = await Promise.all([
        fetchHoldersUpTo(contractAddress, needed),
        fetchTokenInfo(contractAddress),
      ]);

      const sorted = walk.items
        .map((h) => ({
          address: h.address.hash,
          nameTag: h.address.name ?? '',
          balance: BigInt(h.value),
        }))
        .filter((h) => h.balance > 0n)
        .sort((a, b) => {
          if (b.balance > a.balance) return 1;
          if (b.balance < a.balance) return -1;
          return 0;
        });

      // Prefer the explorer's reported total supply; fall back to summing
      // balances if the token-info call failed. That fallback is now a partial
      // sum when the walk stopped early, which only matters if the explorer
      // failed to report a supply at all.
      let totalSupply = tokenInfo.totalSupply;
      if (totalSupply <= 0n) {
        for (const h of sorted) totalSupply += h.balance;
      }

      // The explorer's holders_count is the whole-token total; the walked
      // length is only a prefix unless the cursor ran out.
      const totalHolders = tokenInfo.holdersCount ?? sorted.length;

      data = {
        sorted,
        totalSupply,
        decimals: tokenInfo.decimals,
        totalHolders,
        exhausted: walk.exhausted,
      };
      cache.set(cacheKey, { data, timestamp: Date.now() });
    }

    const { sorted, totalSupply, decimals, totalHolders, exhausted } = data;
    // The cursor walk is capped, so pages past that cap have no data behind them
    // however many holders the explorer reports. Bound the advertised page count
    // to what can actually be served, or "load more" would hand back empty pages.
    const totalPages = Math.min(
      Math.ceil(totalHolders / HOLDERS_PER_PAGE),
      MAX_CURSOR_PAGES
    );
    const startIdx = (page - 1) * HOLDERS_PER_PAGE;
    const pageEntries = sorted.slice(startIdx, startIdx + HOLDERS_PER_PAGE);

    const holders: Holder[] = pageEntries.map((entry, index) => {
      const formatted = formatUnits(entry.balance, decimals);
      // bigint-safe percentage to 4 decimals, trailing zeros stripped (100.0000 -> 100)
      const percentage =
        totalSupply > 0n
          ? parseFloat((Number((entry.balance * 1_000_000n) / totalSupply) / 10000).toFixed(4)) + '%'
          : '0%';

      return {
        rank: startIdx + index + 1,
        address: entry.address,
        nameTag: entry.nameTag,
        quantity: parseFloat(formatted).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        quantityRaw: formatted,
        percentage,
      };
    });

    // When the cursor ran out, `sorted` is the complete list and is the exact
    // authority on whether another page exists. Otherwise the walk stopped
    // early by design, so fall back to the explorer's total.
    const hasMore =
      (exhausted ? sorted.length > startIdx + HOLDERS_PER_PAGE : true) &&
      page < totalPages;

    return NextResponse.json(
      {
        holders,
        totalHolders,
        totalPages,
        currentPage: page,
        hasMore,
      },
      { headers: { 'Cache-Control': CACHE.holders } }
    );
  } catch (error) {
    console.error('Error in token holders API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
