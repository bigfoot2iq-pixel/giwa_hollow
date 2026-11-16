const COMPACT_UNITS = [
  { value: 1e15, suffix: "Q" },
  { value: 1e12, suffix: "T" },
  { value: 1e9, suffix: "B" },
  { value: 1e6, suffix: "M" },
  { value: 1e3, suffix: "K" },
] as const;

export type CompactNumberOptions = {
  /** Maximum decimal places shown for values below the compact threshold. */
  maximumFractionDigits?: number;
  /** Minimum decimal places shown for values below the compact threshold. */
  minimumFractionDigits?: number;
  /** Maximum decimal places shown after K/M/B/T/Q. Defaults to 1. */
  compactFractionDigits?: number;
  /** Values below this stay in full. Defaults to 1,000. */
  compactFrom?: number;
  /** Locale used for grouping and decimal separators. Defaults to en-US. */
  locale?: string;
  /** Returned for null, undefined and non-finite values. Defaults to "—". */
  fallback?: string;
};

export type CompactNumberInput = number | bigint | string | null | undefined;

function trimTrailingZeros(fixed: string): string {
  if (!fixed.includes(".")) return fixed;
  return fixed.replace(/0+$/, "").replace(/\.$/, "");
}

function parseNumber(
  value: Exclude<CompactNumberInput, null | undefined>,
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Shorten a number for tight UI: 1,234 -> "1.2K", 4,500,000 -> "4.5M".
 *
 * Values below `compactFrom` keep their normal grouping and decimals, so small
 * balances and prices stay precise. Fractions after a suffix are trimmed, and
 * rounding that would produce "1000K" steps up to "1M" instead.
 */
export function formatCompactNumber(
  value: CompactNumberInput,
  options: CompactNumberOptions = {},
): string {
  const {
    maximumFractionDigits = 2,
    minimumFractionDigits = 0,
    compactFractionDigits = 1,
    compactFrom = 1_000,
    locale = "en-US",
    fallback = "—",
  } = options;

  if (value === null || value === undefined) return fallback;

  const numeric = parseNumber(value);
  if (numeric === null) return fallback;

  const formatSmall = () =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits,
      minimumFractionDigits,
    }).format(numeric);

  const absolute = Math.abs(numeric);
  if (absolute < compactFrom) {
    return formatSmall();
  }

  const unitIndex = COMPACT_UNITS.findIndex((unit) => absolute >= unit.value);
  if (unitIndex === -1) {
    return formatSmall();
  }

  // Step up a unit when rounding pushes a value to 1000 of the current unit.
  for (let index = unitIndex; index >= 0; index -= 1) {
    const unit = COMPACT_UNITS[index];
    const scaled = absolute / unit.value;
    const digits =
      scaled >= 100
        ? 0
        : Math.min(compactFractionDigits, scaled >= 10 ? 1 : compactFractionDigits);
    const rounded = Number(scaled.toFixed(digits));

    if (rounded < 1_000) {
      const compact = trimTrailingZeros(rounded.toFixed(digits));
      return `${numeric < 0 ? "-" : ""}${compact}${unit.suffix}`;
    }
  }

  return formatSmall();
}
