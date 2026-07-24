import { NextRequest, NextResponse } from 'next/server';
import { formatUnits } from 'viem';
import { giwaSepolia } from '@/lib/contracts/config';

// GIWA Sepolia explorer is Blockscout, which exposes a native token
// holders endpoint — no need to replay transfer events like the old Etherscan
// flow. Blockscout v2 REST is keyless.
const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_EXPLORER_URL ||
  giwaSepolia.blockExplorers?.default?.url ||
  'https://sepolia-explorer.giwa.io';

const ARIWA_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS as string;
const HOLDERS_PER_PAGE = 50;
const MAX_CURSOR_PAGES = 100; // safety cap on the cursor walk
const CACHE_TTL_MS = 60_000; // 60 seconds

interface CachedHolders {
  sorted: { address: string; nameTag: string; balance: bigint }[];
  totalSupply: bigint;
  decimals: number;
}

// In-memory cache keyed by contract address
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

// Walk every holders page via the cursor (next_page_params) until exhausted.
// Blockscout already returns holders sorted by balance descending.
async function fetchAllHolders(contractAddress: string): Promise<BlockscoutHolder[]> {
  const all: BlockscoutHolder[] = [];
  let params: Record<string, string | number> | null = null;

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

    if (!data.next_page_params) break;
    params = data.next_page_params;
  }

  return all;
}

// Token metadata gives the authoritative total supply + decimals for % math.
async function fetchTokenInfo(
  contractAddress: string
): Promise<{ totalSupply: bigint; decimals: number }> {
  try {
    const response = await fetch(`${EXPLORER_BASE}/api/v2/tokens/${contractAddress}`);
    if (!response.ok) return { totalSupply: 0n, decimals: 18 };
    const data: BlockscoutTokenInfo = await response.json();
    return {
      totalSupply: data.total_supply ? BigInt(data.total_supply) : 0n,
      decimals: data.decimals ? parseInt(data.decimals, 10) : 18,
    };
  } catch {
    return { totalSupply: 0n, decimals: 18 };
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

    // Check cache first
    const cacheKey = contractAddress.toLowerCase();
    const cached = cache.get(cacheKey);
    let data: CachedHolders;

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      data = cached.data;
    } else {
      const [rawHolders, tokenInfo] = await Promise.all([
        fetchAllHolders(contractAddress),
        fetchTokenInfo(contractAddress),
      ]);

      const sorted = rawHolders
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
      // balances if the token-info call failed.
      let totalSupply = tokenInfo.totalSupply;
      if (totalSupply <= 0n) {
        for (const h of sorted) totalSupply += h.balance;
      }

      data = { sorted, totalSupply, decimals: tokenInfo.decimals };
      cache.set(cacheKey, { data, timestamp: Date.now() });
    }

    const { sorted, totalSupply, decimals } = data;
    const totalHolders = sorted.length;
    const totalPages = Math.ceil(totalHolders / HOLDERS_PER_PAGE);
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

    return NextResponse.json({
      holders,
      totalHolders,
      totalPages,
      currentPage: page,
      hasMore: page < totalPages,
    });
  } catch (error) {
    console.error('Error in token holders API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
