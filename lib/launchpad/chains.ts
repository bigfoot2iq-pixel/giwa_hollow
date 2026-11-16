import { base, bsc, ink, mainnet } from "viem/chains";
import { giwaSepolia } from "@/lib/contracts/config";

/**
 * Chains the launchpad can use for the "must hold native tokens" gate.
 *
 * The four external checks always read **mainnet** balances: real ETH on
 * Ethereum, Base and Ink, and real BNB on BNB Chain. The deployment itself is
 * still on GIWA Sepolia (GIWA has no live mainnet), so that row keeps reading
 * the deployment chain, where a wallet needs testnet ETH for mint gas anyway.
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
    id: mainnet.id,
    label: mainnet.name,
    symbol: mainnet.nativeCurrency.symbol,
    decimals: mainnet.nativeCurrency.decimals,
    rpcEnv: "ETHEREUM_RPC_URL",
    defaultRpc: "https://ethereum-rpc.publicnode.com",
    /** Default minimum native balance as a human-readable decimal string. */
    defaultMinAmount: "0.001",
  },
  base: {
    id: base.id,
    label: base.name,
    symbol: base.nativeCurrency.symbol,
    decimals: base.nativeCurrency.decimals,
    rpcEnv: "BASE_RPC_URL",
    defaultRpc: "https://base-rpc.publicnode.com",
    /** Default minimum native balance as a human-readable decimal string. */
    defaultMinAmount: "0.001",
  },
  ink: {
    id: ink.id,
    label: ink.name,
    symbol: ink.nativeCurrency.symbol,
    decimals: ink.nativeCurrency.decimals,
    rpcEnv: "INK_RPC_URL",
    defaultRpc: "https://rpc-gel.inkonchain.com",
    /** Default minimum native balance as a human-readable decimal string. */
    defaultMinAmount: "0.001",
  },
  bnb: {
    id: bsc.id,
    label: "BNB Chain",
    symbol: bsc.nativeCurrency.symbol,
    decimals: bsc.nativeCurrency.decimals,
    rpcEnv: "BNB_RPC_URL",
    defaultRpc: "https://bsc-rpc.publicnode.com",
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
