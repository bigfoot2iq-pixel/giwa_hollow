import {
  createPublicClient,
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
 * Server-side half of the one-mint-per-network rule.
 *
 * The browser never sees a raw IP. It asks this module (through
 * `/api/launchpad/mint-permit`) for an EIP-712 permit, and the contract records
 * the resulting hash. The signature is bound to the connected wallet so it
 * cannot be copied, but the hash is what the contract remembers: switching
 * wallets on the same network still cannot mint twice.
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

let publicClient: ReturnType<typeof createPublicClient> | null = null;

function getPublicClient() {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: giwaSepolia,
      transport: http(getRpcUrl(), { timeout: 10_000, retryCount: 1 }),
    });
  }

  return publicClient;
}

function normalizePrivateKey(value: string): Hex | null {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return /^0x[0-9a-fA-F]{64}$/.test(prefixed) ? (prefixed as Hex) : null;
}

async function readIpUsed(ipHash: Hex, contractAddress: Address) {
  return getPublicClient().readContract({
    address: contractAddress,
    abi: AriwaNFTABI,
    functionName: "usedIpHashes",
    args: [ipHash],
  });
}

export async function getIpMintStatus(
  headersList: Headers,
): Promise<IpMintStatus> {
  const contractAddress = getLaunchpadContractAddress();
  if (!contractAddress) {
    return { used: false, ipHash: null, configured: false };
  }

  const ipHash = hashRequestIp(getRequestIp(headersList));

  try {
    const used = await readIpUsed(ipHash, contractAddress);
    return { used, ipHash, configured: true };
  } catch (error) {
    // A read failure must not lock the whole page. The mint route checks again
    // and the contract itself is the final authority.
    console.error("[launchpad] Could not read the network mint status:", error);
    return { used: false, ipHash, configured: true };
  }
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
    const [used, trustedSigner] = await Promise.all([
      readIpUsed(ipHash, contractAddress),
      getPublicClient().readContract({
        address: contractAddress,
        abi: AriwaNFTABI,
        functionName: "trustedSigner",
      }),
    ]);

    if (used) {
      return {
        ok: false,
        code: "already_minted",
        error:
          "This network has already minted its ARIWA NFT. One mint per network.",
      };
    }

    if (trustedSigner.toLowerCase() !== account.address.toLowerCase()) {
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
