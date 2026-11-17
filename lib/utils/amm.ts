/**
 * Constant-product (x * y = k) math, mirrored exactly from AriwaSwapPool so the
 * trade form can quote instantly without an RPC round trip per keystroke.
 */

export const BPS_DENOMINATOR = 10_000n;

/** Fallback until the pool's feeBps is read; matches the contract default. */
export const DEFAULT_FEE_BPS = 30n;

/**
 * ARIWA received for `amountIn` ETH (or ETH received when the reserves are
 * reversed for a sale), net of the swap fee. Always rounds down, like the
 * contract.
 */
export function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: bigint = DEFAULT_FEE_BPS,
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const fee = feeBps > BPS_DENOMINATOR ? BPS_DENOMINATOR : feeBps;
  const amountInWithFee = amountIn * (BPS_DENOMINATOR - fee);
  return (amountInWithFee * reserveOut) / (reserveIn * BPS_DENOMINATOR + amountInWithFee);
}

/**
 * Price impact of a swap in basis points, excluding the swap fee — the fee is
 * displayed as its own line, exactly like Uniswap. Compares the executed rate
 * with the no-impact rate for the same fee-adjusted input.
 */
export function priceImpactBps(
  amountIn: bigint,
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: bigint = DEFAULT_FEE_BPS,
): bigint {
  if (amountIn <= 0n || amountOut <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
    return 0n;
  }

  const fee = feeBps > BPS_DENOMINATOR ? BPS_DENOMINATOR : feeBps;
  const amountInWithFee = amountIn * (BPS_DENOMINATOR - fee);
  const ideal = amountInWithFee * reserveOut;
  const actual = amountOut * reserveIn * BPS_DENOMINATOR;
  if (ideal === 0n || actual >= ideal) return 0n;

  return ((ideal - actual) * BPS_DENOMINATOR) / ideal;
}
