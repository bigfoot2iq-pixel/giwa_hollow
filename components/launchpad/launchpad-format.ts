import { formatEther } from "viem";

/**
 * The live mint parameters read from the AriwaNFT collection.
 *
 * The contract keeps the public phase on-chain: `publicMintOpen` is the switch,
 * `publicPrice` is the price, `maxSupply` is the immutable 2,222 cap and
 * `maxPerWallet` is the owner-controlled per-wallet cap.
 */
export type MintValues = {
  price: bigint;
  supply: bigint;
  walletLimit: bigint;
  minted: bigint;
  publicMintOpen: boolean;
};

export type DropTone =
  | "live"
  | "closed"
  | "soldout"
  | "setup"
  | "loading"
  | "error";

export type DropStatus = {
  label: string;
  tone: DropTone;
  detail: string;
};

export interface HolderCheck {
  chain: string;
  label: string;
  symbol: string;
  minAmount: string;
  balance: string;
  meets: boolean;
  error: string | null;
}

export interface EligibilityResponse {
  eligible: boolean;
  gateEnabled: boolean;
  requirements: HolderCheck[];
}

export type DropStatusInput = {
  configured: boolean;
  /** The contract read failed. */
  error?: boolean;
};

/**
 * One status shared by the summary strip and the mint panel, so both surfaces
 * always describe the drop the same way.
 */
export function getDropStatus(
  values: MintValues | undefined,
  input: DropStatusInput,
): DropStatus {
  if (!input.configured) {
    return {
      label: "Setup pending",
      tone: "setup",
      detail:
        "The collection address has not been set yet. The mint page will unlock as soon as it is deployed.",
    };
  }

  if (input.error) {
    return {
      label: "Unavailable",
      tone: "error",
      detail:
        "The collection could not be read from GIWA. Retry the read before minting.",
    };
  }

  if (!values) {
    return {
      label: "Syncing",
      tone: "loading",
      detail: "Reading the collection from GIWA Sepolia…",
    };
  }

  if (values.supply > 0n && values.minted >= values.supply) {
    return {
      label: "Sold out",
      tone: "soldout",
      detail: "Every piece has found a home in the Hollow.",
    };
  }

  if (!values.publicMintOpen) {
    return {
      label: "Closed",
      tone: "closed",
      detail: "The owner has not opened the public mint yet.",
    };
  }

  return {
    label: "Live",
    tone: "live",
    detail: "Minting is open. First come, first served.",
  };
}

export function formatEth(value: bigint, maxDecimals = 4): string {
  if (value === 0n) return "Free";

  const numeric = Number(formatEther(value));
  if (!Number.isFinite(numeric)) return "—";
  if (numeric < 0.00001) return "<0.00001 ETH";

  const formatted = numeric.toLocaleString(undefined, {
    maximumFractionDigits: maxDecimals,
  });

  if (formatted === "0") {
    return `<${(10 ** -maxDecimals).toLocaleString(undefined, {
      maximumFractionDigits: maxDecimals,
    })} ETH`;
  }

  return `${formatted} ETH`;
}

export function formatCount(value: bigint | number): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString("en-US");
}

/** Formats a holder-gate balance string without inventing precision. */
export function formatAmount(value: string, maxDecimals = 4): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric === 0) return "0";
  if (numeric < 0.00001) return "<0.00001";
  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: maxDecimals,
  });
}

export function shortAddress(address: string, size = 4): string {
  return `${address.slice(0, 2 + size)}…${address.slice(-size)}`;
}
