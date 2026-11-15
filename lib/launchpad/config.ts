import {
  HOLDER_CHAINS,
  HOLDER_CHAIN_KEYS,
  isHolderChainKey,
  type HolderChainKey,
} from "./chains";

export const HOLDER_REQUIREMENTS_CONFIG_KEY = "launchpad_holder_requirements";
export const RAFFLES_MAINTENANCE_CONFIG_KEY = "raffles_maintenance";

export interface HolderRequirement {
  chain: HolderChainKey;
  /** Minimum native-token balance as a human-readable decimal string. */
  minAmount: string;
}

/**
 * The gate ships with one requirement per supported chain. The chain and its
 * native currency are fixed; only `minAmount` is meant to be edited by admins.
 */
export function getDefaultHolderRequirements(): HolderRequirement[] {
  return HOLDER_CHAIN_KEYS.map((chain) => ({
    chain,
    minAmount: HOLDER_CHAINS[chain].defaultMinAmount,
  }));
}

// Native-token amounts have 18 decimals. Reject longer fractions early so a
// bad config row can never make parseUnits throw for every visitor.
const MIN_AMOUNT_PATTERN = /^(?:\d+(?:\.\d{1,18})?|\.\d{1,18})$/;

/**
 * The config table stores a JSON array. Invalid/legacy values are ignored so a
 * bad row can never lock the launchpad behind an empty/broken gate.
 */
export function parseHolderRequirements(value: unknown): HolderRequirement[] {
  if (typeof value !== "string" || !value.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const seen = new Set<HolderChainKey>();
  const requirements: HolderRequirement[] = [];

  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;

    const candidate = entry as { chain?: unknown; minAmount?: unknown };
    if (!isHolderChainKey(candidate.chain)) continue;

    const minAmount =
      typeof candidate.minAmount === "number"
        ? String(candidate.minAmount)
        : typeof candidate.minAmount === "string"
          ? candidate.minAmount.trim()
          : "";

    if (!MIN_AMOUNT_PATTERN.test(minAmount)) continue;

    const numeric = Number(minAmount);
    if (!Number.isFinite(numeric) || numeric <= 0) continue;

    if (seen.has(candidate.chain)) continue;
    seen.add(candidate.chain);
    requirements.push({ chain: candidate.chain, minAmount });
  }

  return requirements;
}

export function serializeHolderRequirements(
  requirements: HolderRequirement[]
): string {
  return JSON.stringify(
    requirements.filter(
      (requirement) =>
        isHolderChainKey(requirement.chain) &&
        MIN_AMOUNT_PATTERN.test(requirement.minAmount) &&
        Number(requirement.minAmount) > 0
    )
  );
}
