"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { format } from "date-fns";
import { ChartCandlestick, ChartLine, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCompactNumber } from "@/lib/utils/format";
import { TokenMark } from "./token-marks";

/** A price sample as returned by AriwaSwapPool.getPriceHistory(). */
export type PriceSample = {
  timestamp: bigint;
  tokensPerEth: bigint;
};

type TradeChartProps = {
  points: readonly PriceSample[] | undefined;
  /** Live ARIWA-per-ETH mid price, fresher than the last recorded sample. */
  liveTokensPerEth: bigint | undefined;
  feeBps: bigint | undefined;
  isLoading?: boolean;
  className?: string;
};

type RangeKey = "1S" | "1M" | "1H" | "1D" | "ALL";
type ChartMode = "area" | "candles";

/** How many candles each timeframe keeps on screen. */
const CANDLE_COUNT = 120;

type Range = {
  key: RangeKey;
  label: string;
  /** Candle size in seconds. 0 lets the chart size them from the span. */
  bucket: number;
  /** Visible window in seconds. 0 shows every recorded sample. */
  window: number;
};

/**
 * Timeframes, narrowest first. Every button fixes a candle size and shows a
 * run of candles wide enough to read. `1S` is the live ticker: each tick adds
 * a one-second candle, so new pool prices appear in real time.
 */
const RANGES: Range[] = [
  { key: "1S", label: "1S", bucket: 1, window: 120 },
  { key: "1M", label: "1M", bucket: 60, window: 60 * CANDLE_COUNT },
  { key: "1H", label: "1H", bucket: 3_600, window: 3_600 * CANDLE_COUNT },
  { key: "1D", label: "1D", bucket: 86_400, window: 86_400 * CANDLE_COUNT },
  { key: "ALL", label: "ALL", bucket: 0, window: 0 },
];

const BUCKET_STEPS = [
  1, 5, 15, 30, 60, 120, 300, 600, 900, 1_800, 3_600, 7_200, 14_400, 21_600,
  43_200, 86_400, 172_800, 604_800, 2_592_000, 7_776_000, 31_536_000,
];

const PRICE_SCALE = 1e18;
const PADDING = { top: 16, right: 64, bottom: 26, left: 8 };

type Point = { t: number; p: number };
type Candle = { t: number; o: number; h: number; l: number; c: number };

function toEthPerToken(tokensPerEth: bigint): number {
  const value = Number(tokensPerEth);
  return value > 0 ? PRICE_SCALE / value : 0;
}

/** Keeps every significant digit visible when the token price is tiny. */
function formatPrice(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000) {
    return formatCompactNumber(value, { maximumFractionDigits: 2 });
  }
  if (value >= 1) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }
  const magnitude = Math.floor(Math.log10(value));
  const digits = Math.min(10, Math.max(2, -magnitude + 4));
  return value.toFixed(digits);
}

/** Labels for the right-hand axis: compact for big numbers, precise for tiny. */
function formatAxis(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (value <= 0) return "0";
  if (value >= 1_000) {
    return formatCompactNumber(value, { maximumFractionDigits: 1 });
  }
  return formatPrice(value);
}

function formatRate(tokensPerEth: bigint | undefined): string {
  if (tokensPerEth === undefined || tokensPerEth === 0n) return "—";
  const value = Number(tokensPerEth) / PRICE_SCALE;
  if (!Number.isFinite(value)) return "—";
  return formatCompactNumber(value, {
    maximumFractionDigits: value >= 100 ? 0 : 2,
    fallback: "—",
  });
}

function formatTime(timestamp: number, span: number): string {
  const date = new Date(timestamp * 1_000);
  if (span > 60 * 86_400) return format(date, "MMM d");
  if (span > 2 * 86_400) return format(date, "MMM d, HH:mm");
  if (span <= 600) return format(date, "HH:mm:ss");
  return format(date, "HH:mm");
}

/** Bucket size that keeps the candle count readable for any window. */
function chooseBucket(span: number): number {
  for (const step of BUCKET_STEPS) {
    if (span / step <= 56) return step;
  }
  return BUCKET_STEPS[BUCKET_STEPS.length - 1];
}

/** Scale a series down to a number of points the SVG can draw smoothly. */
function downsample(points: Point[], limit: number): Point[] {
  if (points.length <= limit) return points;
  const step = (points.length - 1) / (limit - 1);
  return Array.from({ length: limit }, (_, index) => points[Math.round(index * step)]);
}

/**
 * Turn individual samples into continuous OHLC buckets. Empty buckets carry
 * the previous close forward so the chart never opens gaps.
 */
function buildCandles(
  points: Point[],
  bucket: number,
  start: number,
  end: number,
): Candle[] {
  if (points.length === 0) return [];

  const startBucket = Math.floor(start / bucket) * bucket;
  const endBucket = Math.floor(end / bucket) * bucket;

  const byBucket = new Map<number, Candle>();
  let previous = points[0].p;

  for (const point of points) {
    const key = Math.floor(point.t / bucket) * bucket;
    const candle = byBucket.get(key);
    if (!candle) {
      byBucket.set(key, {
        t: key,
        o: previous,
        h: Math.max(previous, point.p),
        l: Math.min(previous, point.p),
        c: point.p,
      });
    } else {
      candle.h = Math.max(candle.h, point.p);
      candle.l = Math.min(candle.l, point.p);
      candle.c = point.p;
    }
    previous = point.p;
  }

  const candles: Candle[] = [];
  let last = points[0].p;
  for (let key = startBucket; key <= endBucket; key += bucket) {
    const candle = byBucket.get(key);
    if (candle) {
      candles.push(candle);
      last = candle.c;
    } else {
      candles.push({ t: key, o: last, h: last, l: last, c: last });
    }
  }

  return candles;
}

/**
 * Live ARIWA/ETH chart. The pool contract records a price point on every trade
 * or liquidity move; this component turns those samples into red/green candles
 * or a filled area line and keeps extending the series to "now".
 */
export function TradeChart({
  points,
  liveTokensPerEth,
  feeBps,
  isLoading = false,
  className,
}: TradeChartProps) {
  const [range, setRange] = useState<RangeKey>("1S");
  const [mode, setMode] = useState<ChartMode>("candles");
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1_000));
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const gradientId = `trade-chart-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };
    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 1_000));
    tick();
    // One-second cadence keeps the live candle and its price edge moving.
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const lastSampleAt =
    points && points.length > 0
      ? Number(points[points.length - 1].timestamp)
      : 0;
  const anchor = Math.max(now, lastSampleAt);
  const livePrice =
    liveTokensPerEth !== undefined && liveTokensPerEth > 0n
      ? toEthPerToken(liveTokensPerEth)
      : undefined;

  /** History plus a synthetic sample at "now" so the line always reaches the edge. */
  const series = useMemo<Point[]>(() => {
    const next: Point[] = [];

    for (const sample of points ?? []) {
      if (sample.tokensPerEth <= 0n) continue;
      const price = toEthPerToken(sample.tokensPerEth);
      if (!Number.isFinite(price) || price <= 0) continue;
      const t = Number(sample.timestamp);
      const previous = next[next.length - 1];
      if (previous && previous.t === t) {
        previous.p = price;
        continue;
      }
      next.push({ t, p: price });
    }

    next.sort((a, b) => a.t - b.t);

    if (livePrice !== undefined && Number.isFinite(livePrice)) {
      const last = next[next.length - 1];
      if (!last) {
        next.push({ t: anchor, p: livePrice });
      } else if (anchor > last.t) {
        next.push({ t: anchor, p: livePrice });
      } else if (last.p !== livePrice) {
        next.push({ t: last.t, p: livePrice });
      }
    }

    return next;
  }, [points, livePrice, anchor]);

  const activeRange = RANGES.find((entry) => entry.key === range) ?? RANGES[0];
  const rangeSeconds = activeRange.window;

  /** Left edge of the visible window; `ALL` starts at the oldest sample. */
  const windowStart =
    rangeSeconds > 0
      ? anchor - rangeSeconds
      : series.length > 0
        ? series[0].t
        : anchor;

  const visible = useMemo<Point[]>(() => {
    if (series.length === 0) return [];
    if (rangeSeconds === 0) return series;

    const inside = series.filter((point) => point.t >= windowStart);
    // Carry the last price from before the window to the left edge so the
    // series is continuous instead of starting mid-air.
    let seed: Point | undefined;
    for (let index = series.length - 1; index >= 0; index -= 1) {
      if (series[index].t < windowStart) {
        seed = series[index];
        break;
      }
    }
    return seed ? [{ t: windowStart, p: seed.p }, ...inside] : inside;
  }, [series, rangeSeconds, windowStart]);

  const hasData = visible.length > 0;

  const xMin = hasData ? windowStart : 0;
  const xMax = hasData
    ? Math.max(anchor, visible[visible.length - 1].t)
    : 60;
  const span = Math.max(xMax - xMin, 60);

  const prices = visible.map((point) => point.p);
  if (livePrice !== undefined) prices.push(livePrice);

  let yMin = prices.length > 0 ? Math.min(...prices) : 0;
  let yMax = prices.length > 0 ? Math.max(...prices) : 1;
  if (prices.length === 0) {
    yMin = 0;
    yMax = 1;
  }
  const pad = yMax - yMin || Math.max(yMax * 0.02, 1e-12);
  yMin = Math.max(0, yMin - pad * 0.18);
  yMax = yMax + pad * 0.18;

  const width = size.width;
  const chartHeight = Math.max(220, size.height || 300);
  const plotW = Math.max(1, width - PADDING.left - PADDING.right);
  const plotH = Math.max(1, chartHeight - PADDING.top - PADDING.bottom);

  const xOf = (timestamp: number) =>
    PADDING.left + ((timestamp - xMin) / span) * plotW;
  const yOf = (price: number) =>
    PADDING.top + ((yMax - price) / (yMax - yMin)) * plotH;

  const candles = useMemo(
    () =>
      buildCandles(
        visible,
        activeRange.bucket > 0 ? activeRange.bucket : chooseBucket(span),
        xMin,
        xMax,
      ),
    [visible, activeRange.bucket, span, xMin, xMax],
  );

  const areaPoints = useMemo(() => downsample(visible, 220), [visible]);

  const firstPrice = visible.length > 0 ? visible[0].p : undefined;
  const lastPrice =
    visible.length > 0
      ? visible[visible.length - 1].p
      : livePrice;
  const change =
    firstPrice !== undefined && lastPrice !== undefined && firstPrice > 0
      ? ((lastPrice - firstPrice) / firstPrice) * 100
      : 0;
  const positive = change >= 0;
  const accent = positive ? "var(--color-success)" : "var(--color-danger)";

  let linePath = "";
  let fillPath = "";
  if (areaPoints.length > 0) {
    const coords = areaPoints.map(
      (point) => `${xOf(point.t).toFixed(2)} ${yOf(point.p).toFixed(2)}`,
    );
    const lastX = xOf(xMax).toFixed(2);
    const lastY = yOf(areaPoints[areaPoints.length - 1].p).toFixed(2);
    const firstX = xOf(areaPoints[0].t).toFixed(2);
    const baseline = (PADDING.top + plotH).toFixed(2);

    linePath = `M ${coords[0]} ${coords
      .slice(1)
      .map((coord) => `L ${coord}`)
      .join(" ")}`;
    // Extend to the live edge when the last sample is older than now.
    linePath += ` L ${lastX} ${lastY}`;
    fillPath = `${linePath} L ${lastX} ${baseline} L ${firstX} ${baseline} Z`;
  }

  const candlesSlot = candles.length > 0 ? plotW / candles.length : 0;

  let hovered: {
    x: number;
    y: number;
    time: number;
    price: number;
    candle?: Candle;
  } | null = null;

  if (hoverIndex !== null) {
    if (mode === "candles" && hoverIndex < candles.length && candlesSlot > 0) {
      const candle = candles[hoverIndex];
      hovered = {
        x: PADDING.left + (hoverIndex + 0.5) * candlesSlot,
        y: yOf(candle.c),
        time: candle.t,
        price: candle.c,
        candle,
      };
    } else if (mode === "area" && hoverIndex < areaPoints.length) {
      const point = areaPoints[hoverIndex];
      hovered = {
        x: xOf(point.t),
        y: yOf(point.p),
        time: point.t,
        price: point.p,
      };
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;

    if (mode === "candles") {
      if (candles.length === 0 || candlesSlot <= 0) return;
      const index = Math.min(
        candles.length - 1,
        Math.max(0, Math.floor((x - PADDING.left) / candlesSlot)),
      );
      setHoverIndex(index);
      return;
    }

    if (areaPoints.length === 0) return;
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < areaPoints.length; index += 1) {
      const distance = Math.abs(xOf(areaPoints[index].t) - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
    setHoverIndex(best);
  };

  const high = prices.length > 0 ? Math.max(...prices) : undefined;
  const low = prices.length > 0 ? Math.min(...prices) : undefined;
  const feeLabel =
    feeBps !== undefined ? `${(Number(feeBps) / 100).toFixed(2)}%` : "—";

  return (
    <section
      className={cn(
        "ui-container relative flex h-full flex-col overflow-hidden rounded-[28px] p-5 sm:p-6 xl:p-8",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-24 -top-28 size-64 rounded-full blur-3xl",
          positive ? "bg-mint/30" : "bg-blush/30",
        )}
      />

      <div className="relative flex flex-1 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex -space-x-2">
                <TokenMark symbol="ARIWA" className="size-7 border-2 border-paper" />
                <TokenMark symbol="ETH" className="size-7 border-2 border-paper" />
              </span>
              <span className="font-header text-sm font-extrabold tracking-[-0.02em] text-ink">
                ARIWA / ETH
              </span>
              <span className="pill">
                <span className="live-dot" />
                {isLoading ? "syncing" : range === "1S" ? "1s live" : "live"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="font-header text-[clamp(1.8rem,4vw,2.4rem)] font-extrabold leading-none tracking-[-0.045em] text-ink">
                {formatPrice(livePrice ?? lastPrice)}
              </span>
              <span className="pb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">
                ETH per ARIWA
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums",
                  positive ? "text-success-ink" : "text-blush-ink",
                )}
                title="Price change across the visible window"
              >
                {positive ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
                {positive ? "+" : ""}
                {change.toFixed(2)}%
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-mute">
                {range === "ALL" ? "all time" : "window change"}
              </span>
              <span className="text-ink-faint">·</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-mute">
                H {formatPrice(high)} · L {formatPrice(low)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-0.5 rounded-full border border-ink/[0.08] bg-paper/70 p-0.5"
              role="group"
              aria-label="Chart type"
            >
              <button
                type="button"
                onClick={() => {
                  setMode("area");
                  setHoverIndex(null);
                }}
                aria-pressed={mode === "area"}
                title="Area chart"
                className={cn(
                  "flex size-7 items-center justify-center rounded-full transition",
                  mode === "area"
                    ? "bg-ink text-cream"
                    : "text-ink-mute hover:text-ink",
                )}
              >
                <ChartLine className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("candles");
                  setHoverIndex(null);
                }}
                aria-pressed={mode === "candles"}
                title="Candlestick chart"
                className={cn(
                  "flex size-7 items-center justify-center rounded-full transition",
                  mode === "candles"
                    ? "bg-ink text-cream"
                    : "text-ink-mute hover:text-ink",
                )}
              >
                <ChartCandlestick className="size-3.5" />
              </button>
            </div>

            <div
              className="flex items-center gap-0.5 rounded-full border border-ink/[0.08] bg-paper/70 p-0.5"
              role="group"
              aria-label="Timeframe"
            >
              {RANGES.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => {
                    setRange(entry.key);
                    setHoverIndex(null);
                  }}
                  aria-pressed={range === entry.key}
                  className={cn(
                    "h-7 rounded-full px-2.5 font-mono text-[8.5px] font-semibold uppercase tracking-[0.1em] transition",
                    range === entry.key
                      ? "bg-iris-strong text-white shadow-[0_6px_14px_-9px_rgba(108,85,224,0.9)]"
                      : "text-ink-mute hover:text-ink",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div ref={wrapperRef} className="relative mt-4 min-h-[260px] w-full flex-1">
          {width > 0 ? (
            <svg
              width={width}
              height={chartHeight}
              viewBox={`0 0 ${width} ${chartHeight}`}
              role="img"
              aria-label={`ARIWA price chart, ${formatPrice(
                livePrice ?? lastPrice,
              )} ETH per ARIWA`}
              className="absolute inset-0 block touch-none select-none"
              onPointerMove={handlePointerMove}
              onPointerDown={handlePointerMove}
              onPointerLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={accent} stopOpacity="0.015" />
                </linearGradient>
              </defs>

              {[0, 1, 2, 3].map((index) => {
                const y = PADDING.top + (plotH * index) / 3;
                const value = yMax - ((yMax - yMin) * index) / 3;
                return (
                  <g key={index}>
                    <line
                      x1={PADDING.left}
                      x2={PADDING.left + plotW}
                      y1={y}
                      y2={y}
                      stroke="var(--line)"
                      strokeWidth={1}
                      strokeDasharray="2 7"
                    />
                    <text
                      x={width - PADDING.right + 9}
                      y={y + 3}
                      fontSize={8.5}
                      fill="var(--color-ink-faint)"
                      fontFamily="var(--font-mono)"
                    >
                      {formatAxis(value)}
                    </text>
                  </g>
                );
              })}

              {mode === "area" && hasData && (
                <>
                  <path d={fillPath} fill={`url(#${gradientId})`} />
                  <path
                    d={linePath}
                    fill="none"
                    stroke={accent}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {areaPoints.length <= 64 &&
                    areaPoints.map((point, index) => {
                      if (index === 0) return null;
                      const previous = areaPoints[index - 1];
                      const colour =
                        point.p >= previous.p
                          ? "var(--color-success)"
                          : "var(--color-danger)";
                      return (
                        <circle
                          key={`${point.t}-${index}`}
                          cx={xOf(point.t)}
                          cy={yOf(point.p)}
                          r={2.4}
                          fill={colour}
                          stroke="var(--color-paper)"
                          strokeWidth={1}
                          opacity={0.9}
                        />
                      );
                    })}
                </>
              )}

              {mode === "candles" &&
                candles.map((candle, index) => {
                  const x = PADDING.left + (index + 0.5) * candlesSlot;
                  const bodyWidth = Math.max(
                    1.5,
                    Math.min(10, candlesSlot * 0.62),
                  );
                  const colour =
                    candle.c >= candle.o
                      ? "var(--color-success)"
                      : "var(--color-danger)";
                  const openY = yOf(candle.o);
                  const closeY = yOf(candle.c);
                  const bodyTop = Math.min(openY, closeY);
                  const bodyHeight = Math.max(1.2, Math.abs(closeY - openY));

                  return (
                    <g key={candle.t}>
                      <line
                        x1={x}
                        x2={x}
                        y1={yOf(candle.h)}
                        y2={yOf(candle.l)}
                        stroke={colour}
                        strokeWidth={1}
                        opacity={0.8}
                      />
                      <rect
                        x={x - bodyWidth / 2}
                        y={bodyTop}
                        width={bodyWidth}
                        height={bodyHeight}
                        rx={1}
                        fill={colour}
                        opacity={0.88}
                      />
                    </g>
                  );
                })}

              {livePrice !== undefined && (
                <line
                  x1={PADDING.left}
                  x2={PADDING.left + plotW}
                  y1={yOf(livePrice)}
                  y2={yOf(livePrice)}
                  stroke={accent}
                  strokeWidth={1}
                  strokeDasharray="4 5"
                  opacity={0.55}
                />
              )}

              {hasData && mode === "area" && (
                <g>
                  <circle
                    cx={xOf(visible[visible.length - 1].t)}
                    cy={yOf(visible[visible.length - 1].p)}
                    r={5}
                    fill={accent}
                    opacity={0.18}
                    className="animate-pulse-soft"
                  />
                  <circle
                    cx={xOf(visible[visible.length - 1].t)}
                    cy={yOf(visible[visible.length - 1].p)}
                    r={2.6}
                    fill={accent}
                    stroke="var(--color-paper)"
                    strokeWidth={1.5}
                  />
                </g>
              )}

              {[0, 0.5, 1].map((fraction, index) => {
                const timestamp = xMin + span * fraction;
                const x = PADDING.left + plotW * fraction;
                return (
                  <text
                    key={index}
                    x={x}
                    y={chartHeight - 8}
                    textAnchor={index === 0 ? "start" : index === 2 ? "end" : "middle"}
                    fontSize={8.5}
                    fill="var(--color-ink-faint)"
                    fontFamily="var(--font-mono)"
                  >
                    {formatTime(timestamp, span)}
                  </text>
                );
              })}

              {livePrice !== undefined && (
                <g>
                  <rect
                    x={width - PADDING.right + 4}
                    y={Math.min(
                      Math.max(yOf(livePrice) - 7, 2),
                      chartHeight - 16,
                    )}
                    width={PADDING.right - 8}
                    height={15}
                    rx={4}
                    fill="var(--color-ink)"
                    opacity={0.94}
                  />
                  <text
                    x={width - PADDING.right / 2 - 2}
                    y={
                      Math.min(
                        Math.max(yOf(livePrice) - 7, 2),
                        chartHeight - 16,
                      ) + 10.5
                    }
                    textAnchor="middle"
                    fontSize={8}
                    fontWeight={600}
                    fill="var(--color-cream)"
                    fontFamily="var(--font-mono)"
                  >
                    {formatPrice(livePrice)}
                  </text>
                </g>
              )}

              {hovered && (
                <g pointerEvents="none">
                  <line
                    x1={hovered.x}
                    x2={hovered.x}
                    y1={PADDING.top}
                    y2={PADDING.top + plotH}
                    stroke="var(--color-ink-faint)"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    opacity={0.8}
                  />
                  {mode === "candles" && (
                    <line
                      x1={PADDING.left}
                      x2={PADDING.left + plotW}
                      y1={hovered.y}
                      y2={hovered.y}
                      stroke="var(--color-ink-faint)"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      opacity={0.45}
                    />
                  )}
                  <circle
                    cx={hovered.x}
                    cy={hovered.y}
                    r={3.5}
                    fill={accent}
                    stroke="var(--color-paper)"
                    strokeWidth={2}
                  />
                </g>
              )}
            </svg>
          ) : (
            <div className="absolute inset-0 w-full animate-pulse-soft rounded-2xl bg-ink/[0.03]" />
          )}

          {width > 0 && !hasData && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
              <p className="font-header text-sm font-extrabold tracking-[-0.02em] text-ink-soft">
                The chart wakes up on the first trade
              </p>
              <p className="max-w-[240px] text-[10.5px] leading-5 text-ink-mute">
                Buy or sell ARIWA and the pool records the price here.
              </p>
            </div>
          )}

          {hovered && (
            <div
              className="pointer-events-none absolute z-10 rounded-xl border border-ink/10 bg-paper/95 px-3 py-2 shadow-[0_22px_50px_-32px_rgba(39,33,50,0.8)] backdrop-blur"
              style={{
                left: Math.min(Math.max(hovered.x + 12, 6), Math.max(6, width - 164)),
                top: 8,
              }}
            >
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-mute">
                {format(
                  new Date(hovered.time * 1_000),
                  span <= 600 ? "MMM d, HH:mm:ss" : "MMM d, HH:mm",
                )}
              </p>
              {hovered.candle ? (
                <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[9.5px]">
                  {(
                    [
                      ["O", hovered.candle.o],
                      ["H", hovered.candle.h],
                      ["L", hovered.candle.l],
                      ["C", hovered.candle.c],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex items-center gap-1">
                      <dt className="text-ink-faint">{label}</dt>
                      <dd className="tabular-nums text-ink">{formatPrice(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-1 font-header text-sm font-extrabold tracking-[-0.02em] text-ink">
                  {formatPrice(hovered.price)}
                  <span className="ml-1 font-mono text-[8px] font-normal uppercase tracking-[0.12em] text-ink-mute">
                    ETH
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-ink/[0.07] pt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-mute">
          <span>
            1 ETH ≈{" "}
            <span className="font-semibold text-ink-soft">
              {formatRate(liveTokensPerEth)} ARIWA
            </span>
          </span>
          <span className="flex items-center gap-3">
            <span>Fee {feeLabel}</span>
            <span className="text-ink-faint">·</span>
            <span>On-chain price feed</span>
          </span>
        </div>
      </div>
    </section>
  );
}
