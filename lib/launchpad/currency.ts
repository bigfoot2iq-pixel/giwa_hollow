import { formatUnits, parseAbi, zeroAddress } from "viem";
import { formatCompactNumber } from "@/lib/utils/format";

/** Standard ERC20 surface for the launchpad's payment asset. */
export const ERC20_PAYMENT_ABI = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

/**
 * The asset a launchpad mint is paid in. `paymentToken` is the collection's
 * on-chain setting: the zero address means native ETH, anything else is an
 * ERC20 (ARIWA by default).
 */
export type PaymentCurrency = {
  /** ERC20 address, or the zero address for the chain's native currency. */
  token: `0x${string}`;
  symbol: string;
  decimals: number;
  isNative: boolean;
};

export const NATIVE_CURRENCY: PaymentCurrency = {
  token: zeroAddress,
  symbol: "ETH",
  decimals: 18,
  isNative: true,
};

/** The ARIWA token's decimals; used until the on-chain read resolves. */
export const DEFAULT_ERC20_DECIMALS = 18;

/** True when the collection charges an ERC20 instead of native ETH. */
export function isErc20Payment(currency: PaymentCurrency): boolean {
  return !currency.isNative;
}

/**
 * Formats a price in the collection's payment asset, with the asset's own
 * decimals and symbol.
 */
export function formatCurrency(
  value: bigint,
  currency: PaymentCurrency,
  maxDecimals = 4,
): string {
  if (value === 0n) return "Free";

  const numeric = Number(formatUnits(value, currency.decimals));
  if (!Number.isFinite(numeric)) return "—";
  if (numeric < 0.00001) return `<0.00001 ${currency.symbol}`;

  const formatted = formatCompactNumber(numeric, {
    maximumFractionDigits: maxDecimals,
  });

  if (formatted === "0") {
    return `<${(10 ** -maxDecimals).toLocaleString(undefined, {
      maximumFractionDigits: maxDecimals,
    })} ${currency.symbol}`;
  }

  return `${formatted} ${currency.symbol}`;
}
