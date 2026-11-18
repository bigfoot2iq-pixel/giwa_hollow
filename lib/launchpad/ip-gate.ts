import {
  createPublicClient,
  fallback,
  http,
  isAddress,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  AriwaNFTABI,
  giwaSepolia,
  LAUNCHPAD_NFT_ADDRESS,
} from "@/lib/contracts";
import type {
  IpMintStatus,
  MintPermit,
  MintPermitErrorCode,
} from "./mint-permit";
import {
  MINT_PERMIT_DOMAIN_NAME,
  MINT_PERMIT_DOMAIN_VERSION,
  MINT_PERMIT_TYPES,
} from "./mint-permit";

/**
 * Server-side half of the one-mint-per-user rule.
 *
 * The browser never sees a raw IP. It asks this module (through
 * `/api/launchpad/mint-permit`) for an EIP-712 permit, and the contract records
 * the resulting hash. The signature is bound to the connected wallet so it
 * cannot be copied, but the hash is what the contract remembers: switching
 * wallets still cannot mint twice.
 *
 * IPs are read from Cloudflare's `cf-connecting-ip` first; that header is set
 * by the edge and cannot be spoofed by the browser. `x-forwarded-for` and
 * `x-real-ip` are fallbacks for local/other hosts.
 */

const IP_HEADER_NAMES = [
  "cf-connecting-ip",
  "x-forwarded-for",
  "x-real-ip",
] as const;

function shortErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const short = (error as Error & { shortMessage?: string }).shortMessage;
    return (short || error.message).split("\n")[0];
  }
  return String(error);
}

export function getRequestIp(headersList: Headers): string {
  for (const name of IP_HEADER_NAMES) {
    const value = headersList.get(name);
    if (!value) continue;

    const ip = name === "x-forwarded-for" ? value.split(",")[0] : value;
    const trimmed = ip?.trim();
    if (trimmed) return trimmed;
  }

  return "unknown";
}

/**
 * Hash the visitor's network with a server secret before it goes on-chain.
 * Rotating the secret starts a fresh limit, so keep it stable for the life of
 * the collection.
 */
export function hashRequestIp(ip: string): Hex {
  const secret = process.env.LAUNCHPAD_IP_HASH_SECRET?.trim();

  if (!secret && process.env.NODE_ENV === "production") {
    console.warn(
      "[launchpad] LAUNCHPAD_IP_HASH_SECRET is not set - network hashes are using the public fallback",
    );
  }

  return keccak256(stringToHex(`${secret || "ariwa-launchpad"}:${ip}`));
}

export function getLaunchpadContractAddress(): Address | null {
  return LAUNCHPAD_NFT_ADDRESS && isAddress(LAUNCHPAD_NFT_ADDRESS)
    ? LAUNCHPAD_NFT_ADDRESS
    : null;
}

function getRpcUrl(): string {
  return (
    process.env.RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    giwaSepolia.rpcUrls.default.http[0]
  );
}

/**
 * The official GIWA Sepolia endpoint is rate-limited and explicitly not meant
 * for production. Pocket Network runs a free public GIWA Sepolia endpoint
 * without an API key, so server reads fail over to it instead of dropping the
 * mint. Override with GIWA_FALLBACK_RPC_URL when a dedicated provider is added.
 */
function getFallbackRpcUrl(): string {
  return (
    process.env.GIWA_FALLBACK_RPC_URL?.trim() ||
    "https://giwa-sepolia-testnet.api.pocket.network"
  );
}

let publicClient: ReturnType<typeof createPublicClient> | null = null;

const USED_FALSE_TTL_MS = 15_000;
const TRUSTED_SIGNER_TTL_MS = 5 * 60_000;
const MAX_USED_CACHE_ENTRIES = 5_000;

let trustedSignerCache: { address: Address; fetchedAt: number } | null = null;

const usedCache = new Map<string, { used: boolean; fetchedAt: number }>();

function readUsedCache(ipHash: Hex): boolean | null {
  const hit = usedCache.get(ipHash);
  if (!hit) return null;

  // `used = true` is permanent on-chain, so keep it for the life of the
  // isolate. Only a negative answer expires.
  if (!hit.used && Date.now() - hit.fetchedAt > USED_FALSE_TTL_MS) {
    usedCache.delete(ipHash);
    return null;
  }

  return hit.used;
}

function writeUsedCache(ipHash: Hex, used: boolean) {
  usedCache.set(ipHash, { used, fetchedAt: Date.now() });

  if (usedCache.size > MAX_USED_CACHE_ENTRIES) {
    const oldest = usedCache.keys().next().value;
    if (oldest !== undefined) usedCache.delete(oldest);
  }
}

function getPublicClient() {
  if (!publicClient) {
    const primary = getRpcUrl();
    const secondary = getFallbackRpcUrl();

    publicClient = createPublicClient({
      chain: giwaSepolia,
      // Reads are best-effort: the first endpoint is tried, and a rate-limited
      // answer falls through to the public Pocket endpoint instead of failing
      // the permit. The contract remains the real authority.
      transport: fallback(
        [
          http(primary, { timeout: 4_000, retryCount: 1 }),
          ...(secondary && secondary !== primary
            ? [http(secondary, { timeout: 4_000, retryCount: 1 })]
            : []),
        ],
      ),
    });
  }

  return publicClient;
}

function normalizePrivateKey(value: string): Hex | null {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return /^0x[0-9a-fA-F]{64}$/.test(prefixed) ? (prefixed as Hex) : null;
}

async function fetchIpUsed(ipHash: Hex, contractAddress: Address) {
  return getPublicClient().readContract({
    address: contractAddress,
    abi: AriwaNFTABI,
    functionName: "usedIpHashes",
    args: [ipHash],
  });
}

/**
 * Best-effort read with a short-lived cache.
 *
 * `null` means "the RPC did not answer". Callers must not treat that as
 * "unused": the contract is the real authority, so an unknown value should
 * never block a legitimate mint.
 */
async function readIpUsedSafe(
  ipHash: Hex,
  contractAddress: Address,
): Promise<boolean | null> {
  const cached = readUsedCache(ipHash);
  if (cached !== null) return cached;

  try {
    const used = await fetchIpUsed(ipHash, contractAddress);
    writeUsedCache(ipHash, used);
    return used;
  } catch (error) {
    console.error(
      "[launchpad] Could not read the user's mint status:",
      shortErrorMessage(error),
    );
    return null;
  }
}

async function readTrustedSignerSafe(
  contractAddress: Address,
): Promise<Address | null> {
  if (
    trustedSignerCache &&
    Date.now() - trustedSignerCache.fetchedAt < TRUSTED_SIGNER_TTL_MS
  ) {
    return trustedSignerCache.address;
  }

  try {
    const address = await getPublicClient().readContract({
      address: contractAddress,
      abi: AriwaNFTABI,
      functionName: "trustedSigner",
    });
    trustedSignerCache = { address, fetchedAt: Date.now() };
    return address;
  } catch (error) {
    console.error(
      "[launchpad] Could not read the trusted signer:",
      shortErrorMessage(error),
    );
    return null;
  }
}

export async function getIpMintStatus(
  headersList: Headers,
): Promise<IpMintStatus> {
  const contractAddress = getLaunchpadContractAddress();
  if (!contractAddress) {
    return { used: false, ipHash: null, configured: false };
  }

  const ipHash = hashRequestIp(getRequestIp(headersList));
  const used = await readIpUsedSafe(ipHash, contractAddress);

  return { used: used === true, ipHash, configured: true };
}

export type CreateMintPermitResult =
  | { ok: true; permit: MintPermit }
  | { ok: false; code: MintPermitErrorCode; error: string };

export async function createMintPermit(
  headersList: Headers,
  wallet: Address,
): Promise<CreateMintPermitResult> {
  const contractAddress = getLaunchpadContractAddress();
  if (!contractAddress) {
    return {
      ok: false,
      code: "not_configured",
      error: "The collection address is not configured.",
    };
  }

  const privateKey = normalizePrivateKey(
    process.env.LAUNCHPAD_PERMIT_SIGNER_PRIVATE_KEY || "",
  );
  if (!privateKey) {
    return {
      ok: false,
      code: "not_configured",
      error: "The mint permit signer is not configured.",
    };
  }

  const account = privateKeyToAccount(privateKey);
  const ipHash = hashRequestIp(getRequestIp(headersList));

  try {
    // Both reads are best-effort. The contract is the source of truth, so an
    // RPC hiccup must not stop the user from reaching their wallet: an unused
    // permit is harmless, and a used permit is rejected on-chain.
    const [used, trustedSigner] = await Promise.all([
      readIpUsedSafe(ipHash, contractAddress),
      readTrustedSignerSafe(contractAddress),
    ]);

    if (used === true) {
      return {
        ok: false,
        code: "already_minted",
        error: "You have already minted an ARIWA NFT. One NFT per user.",
      };
    }

    if (
      trustedSigner &&
      trustedSigner.toLowerCase() !== account.address.toLowerCase()
    ) {
      console.error(
        "[launchpad] The configured permit signer does not match the contract's trustedSigner",
      );
      return {
        ok: false,
        code: "not_configured",
        error: "The mint permit signer is not authorised by the collection.",
      };
    }

    const signature = await account.signTypedData({
      domain: {
        name: MINT_PERMIT_DOMAIN_NAME,
        version: MINT_PERMIT_DOMAIN_VERSION,
        chainId: giwaSepolia.id,
        verifyingContract: contractAddress,
      },
      types: MINT_PERMIT_TYPES,
      primaryType: "MintPermit",
      message: { ipHash, wallet },
    });

    return {
      ok: true,
      permit: {
        ipHash,
        signature,
        signer: account.address,
        verifyingContract: contractAddress,
        chainId: giwaSepolia.id,
      },
    };
  } catch (error) {
    console.error("[launchpad] Could not issue a mint permit:", error);
    return {
      ok: false,
      code: "unavailable",
      error: "Could not verify the network. Please try again.",
    };
  }
}
