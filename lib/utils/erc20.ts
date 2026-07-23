import { parseUnits, formatUnits, createPublicClient, http } from "viem";
import { giwaSepolia } from "@/lib/contracts/config";

/**
 * Standard ERC20 ABI for decimals() function
 */
export const ERC20_DECIMALS_ABI = [
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
] as const;

/**
 * Standard ERC721 ABI for name() function
 */
export const ERC721_METADATA_ABI = [
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
] as const;

/**
 * Convert human-readable token amount to wei/smallest unit
 * @param amount - Human readable amount (e.g., "100.5")
 * @param decimals - Token decimals (e.g., 18 for most tokens, 6 for USDC)
 * @returns Amount in smallest unit as string
 */
export function toTokenUnits(amount: string, decimals: number): string {
  return parseUnits(amount, decimals).toString();
}

/**
 * Convert wei/smallest unit to human-readable token amount
 * @param amount - Amount in smallest unit
 * @param decimals - Token decimals
 * @returns Human readable amount as string
 */
export function fromTokenUnits(amount: string | bigint, decimals: number): string {
  return formatUnits(BigInt(amount), decimals);
}

/**
 * Fetch token metadata (name and symbol) from contract
 * @param tokenAddress - Token contract address
 * @param isNFT - Whether the token is an NFT (ERC721/ERC6220)
 * @returns Token metadata with name and symbol
 */
export async function getTokenMetadata(
  tokenAddress: string,
  isNFT: boolean = false
): Promise<{ name: string; symbol: string } | null> {
  try {
    const client = createPublicClient({
      chain: giwaSepolia,
      transport: http(),
    });

    const abi = isNFT ? ERC721_METADATA_ABI : ERC20_DECIMALS_ABI;

    const [name, symbol] = await Promise.all([
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi,
        functionName: "name",
      }),
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi,
        functionName: "symbol",
      }),
    ]);

    return {
      name: name as string,
      symbol: symbol as string,
    };
  } catch (error) {
    console.error("Failed to fetch token metadata:", error);
    return null;
  }
}

/**
 * Cache for token metadata to avoid repeated contract calls
 */
const tokenMetadataCache = new Map<string, { name: string; symbol: string }>();

/**
 * Fetch token metadata with caching
 * @param tokenAddress - Token contract address
 * @param isNFT - Whether the token is an NFT
 * @returns Token metadata with name and symbol
 */
export async function getTokenMetadataCached(
  tokenAddress: string,
  isNFT: boolean = false
): Promise<{ name: string; symbol: string } | null> {
  const cacheKey = `${tokenAddress}-${isNFT}`;
  
  if (tokenMetadataCache.has(cacheKey)) {
    return tokenMetadataCache.get(cacheKey)!;
  }

  const metadata = await getTokenMetadata(tokenAddress, isNFT);
  
  if (metadata) {
    tokenMetadataCache.set(cacheKey, metadata);
  }

  return metadata;
}
