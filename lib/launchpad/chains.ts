import { baseSepolia, bscTestnet, inkSepolia, sepolia } from "viem/chains";
import { giwaSepolia } from "@/lib/contracts/config";

/**
 * Chains the launchpad can use for the "must hold native tokens" gate.
 *
 * This deployment runs on **GIWA Sepolia**, so every gate chain is a testnet as
 * well: the balances a visitor can realistically hold are faucet balances. A
 * wallet funded from a Sepolia faucet must therefore satisfy the row labelled
 * "Ethereum Sepolia" — pointing the gate at mainnet silently reads 0 for
 * everyone and locks the mint.
 *
 * When this app ships on GIWA mainnet, swap these four back to `mainnet`,
 * `base`, `ink` and `bsc` (and re-seed the minimums in the admin UI).
 *
 * Chain IDs, names and native currencies come from viem's canonical chain
 * definitions, except GIWA which reuses the app's own chain definition so the
 * id can never drift from `NEXT_PUBLIC_RPC_URL`/`NEXT_PUBLIC_CHAIN_ID`. The
 * currency of a chain is fixed by the network itself, so only the minimum
 * amount is admin-configurable. All native tokens use 18 decimals.
 *
 * Balances are checked server-side against a public RPC by default. Override
 * any endpoint with the `*_RPC_URL` environment variable when the public
 * endpoints are rate-limited in production.
 */
export const HOLDER_CHAINS = {
  giwa: {
    id: giwaSepolia.id,
    label: giwaSepolia.name,
    symbol: giwaSepolia.nativeCurrency.symbol,
    decimals: giwaSepolia.nativeCurrency.decimals,
    rpcEnv: "GIWA_RPC_URL",
    defaultRpc: giwaSepolia.rpcUrls.default.http[0],
    /** Default minimum native balance as a human-readable decimal string. */
    defaultMinAmount: "0.001",
  },
  ethereum: {
    id: sepolia.id,
    label: "Ethereum Sepolia",
    symbol: sepolia.nativeCurrency.symbol,
    decimals: sepolia.nativeCurrency.decimals,
    rpcEnv: "ETHEREUM_RPC_URL",
    defaultRpc: "https://ethereum-sepolia-rpc.publicnode.com",
    /** Default minimum native balance as a human-readable decimal string. */
    defaultMinAmount: "0.001",
  },
  base: {
    id: baseSepolia.id,
    label: "Base Sepolia",
    symbol: baseSepolia.nativeCurrency.symbol,
    decimals: baseSepolia.nativeCurrency.decimals,
    rpcEnv: "BASE_RPC_URL",
    defaultRpc: "https://base-sepolia-rpc.publicnode.com",
    /** Default minimum native balance as a human-readable decimal string. */
    defaultMinAmount: "0.001",
  },
  ink: {
    id: inkSepolia.id,
    label: "Ink Sepolia",
    symbol: inkSepolia.nativeCurrency.symbol,
    decimals: inkSepolia.nativeCurrency.decimals,
    rpcEnv: "INK_RPC_URL",
    defaultRpc: "https://rpc-gel-sepolia.inkonchain.com",
    /** Default minimum native balance as a human-readable decimal string. */
    defaultMinAmount: "0.001",
  },
  bnb: {
    id: bscTestnet.id,
    label: "BNB Testnet",
    symbol: bscTestnet.nativeCurrency.symbol,
    decimals: bscTestnet.nativeCurrency.decimals,
    rpcEnv: "BNB_RPC_URL",
    defaultRpc: "https://bsc-testnet-rpc.publicnode.com",
    /** Default minimum native balance as a human-readable decimal string. */
    defaultMinAmount: "0.003",
  },
} as const;

export type HolderChainKey = keyof typeof HOLDER_CHAINS;

export const HOLDER_CHAIN_KEYS = Object.keys(HOLDER_CHAINS) as HolderChainKey[];

export function isHolderChainKey(value: unknown): value is HolderChainKey {
  return typeof value === "string" && value in HOLDER_CHAINS;
}

export function getHolderChainRpcUrl(chain: HolderChainKey): string {
  const config = HOLDER_CHAINS[chain];
  return process.env[config.rpcEnv] || config.defaultRpc;
}
