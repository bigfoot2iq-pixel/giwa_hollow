import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { PrizeType, Raffle, RaffleStatus } from "@/lib/supabase";
import { CountdownTimer } from "./CountdownTimer";
import { getTokenMetadataCached, fromTokenUnits } from "@/lib/utils/erc20";
import { contracts } from "@/lib/contracts/config";

export type CardPrize = {
  prize_type: PrizeType;
  prize_token_address: string;
  prize_amount: string | null;
  prize_token_id: string | null;
};

interface RaffleCardProps {
  raffle: Raffle & {
    status: RaffleStatus;
    prize_types: PrizeType[];
    prizes: CardPrize[];
    participants_count: number;
  };
  basePath?: string;
}

const prizeTypeLabels: Record<PrizeType, string> = {
  erc20: "Token",
  erc721: "NFT",
  erc6220: "ERC6220",
};

const isNftPrize = (type: PrizeType) => type === "erc721" || type === "erc6220";

// Short, local-timezone date+time, e.g. "Jun 22, 14:00". Used so users see the
// exact moment a raffle opens / closes, not just a relative countdown.
function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrizeAmount(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function RaffleCard({ raffle, basePath = "/raffles" }: RaffleCardProps) {
  const [tokenSymbol, setTokenSymbol] = useState<string>("ARIWA");
  const [prizeLabel, setPrizeLabel] = useState<string>("");

  const isActive = raffle.status === "active";
  const isEnded = raffle.status === "ended";
  const backupRafflesThatAreEnded = ['b412fc76-06a9-47fc-9540-46a49cdfad81', '86b1bafb-a03a-451e-9732-4966a63c1d68', 'b9788d7f-5f66-431e-823f-6f040d998fb4'].includes(raffle.id);
  const prizeTypes = raffle.prize_types || [];
  const uniquePrizeTypes = Array.from(new Set(prizeTypes));
  const primaryPrizeType = uniquePrizeTypes[0];
  const isNFT = uniquePrizeTypes.some(isNftPrize);
  const typeLabel =
    uniquePrizeTypes.length === 0
      ? "TBD"
      : uniquePrizeTypes.length === 1 && primaryPrizeType
      ? prizeTypeLabels[primaryPrizeType]
      : "Multiple";

  const prizes = raffle.prizes || [];
  const primaryPrize = prizes[0];
  const extraPrizeCount = Math.max(0, prizes.length - 1);

  // Fetch entry-token symbol (secondary cost line)
  useEffect(() => {
    let active = true;
    getTokenMetadataCached(contracts.ariwaToken.address, false).then((m) => {
      if (active && m) setTokenSymbol(m.symbol);
    });
    return () => {
      active = false;
    };
  }, []);

  // Resolve the prize into a human-readable "what you win" label
  useEffect(() => {
    let active = true;
    if (!primaryPrize) {
      setPrizeLabel("");
      return;
    }
    const isNft = isNftPrize(primaryPrize.prize_type);
    getTokenMetadataCached(primaryPrize.prize_token_address, isNft).then((meta) => {
      if (!active) return;
      if (primaryPrize.prize_type === "erc20") {
        const amount = primaryPrize.prize_amount
          ? formatPrizeAmount(fromTokenUnits(primaryPrize.prize_amount, 18))
          : "0";
        setPrizeLabel(`${amount} ${meta?.symbol || "Token"}`);
      } else {
        const name = meta?.name || meta?.symbol || "NFT";
        setPrizeLabel(primaryPrize.prize_token_id ? `${name} #${primaryPrize.prize_token_id}` : name);
      }
    });
    return () => {
      active = false;
    };
  }, [primaryPrize]);

  const displayPrize = prizeLabel || (primaryPrize ? prizeTypeLabels[primaryPrize.prize_type] : "TBD");

  return (
    <Link href={`${basePath}/${raffle.slug || raffle.id}`}>
      <div className={`ui-container rounded overflow-hidden flex flex-col group transition-transform hover:translate-y-[-4px] ${isEnded || backupRafflesThatAreEnded ? "opacity-50" : ""}`}>
        {/* Image */}
        <div className={`h-72 overflow-hidden relative bg-dark-navy ${isNFT ? "" : "flex items-center justify-center border-b border-black/10"}`}>
          {raffle.image_url ? (
            <Image
              alt={raffle.title}
              fill
              className="object-contain group-hover:scale-105 transition-transform duration-700"
              src={raffle.image_url}
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : isNFT ? (
            <div className="w-full h-full bg-dark-navy flex items-center justify-center">
              <span className="material-symbols-outlined text-muted-blue text-6xl">image</span>
            </div>
          ) : (
            <Image
              alt="RH"
              width={90}
              height={56}
              unoptimized
              className="object-contain group-hover:scale-110 transition-transform duration-700"
              src="/ariwa-logo.png"
            />
          )}
          <div className="absolute top-3 left-3 flex gap-1.5">
            <span className="bg-[#ffffff] text-[#0062df] text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">
              Type: {typeLabel}
            </span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${
              isActive
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : (isEnded || backupRafflesThatAreEnded)
                ? "bg-black/10 text-muted-blue border border-black/10"
                : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
            }`}>
              {raffle.status === "active" ? "Live" : raffle.status === "pending" ? "Upcoming" : "Ended"}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">
          {/* 1. Countdown — urgency first */}
          {raffle.status === "pending" && raffle.start_date && (
            <div className="mb-3 p-2.5 rounded border bg-blue-500/5 border-blue-500/20">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[8px] font-bold uppercase text-blue-400 tracking-widest">Starts in</span>
                <span className="text-[9px] text-muted-blue">{formatDateTime(raffle.start_date)}</span>
              </div>
              <CountdownTimer endDate={raffle.start_date} />
            </div>
          )}

          {(isActive || isEnded || backupRafflesThatAreEnded) && raffle.end_date && (
            <div className={`mb-3 p-2.5 rounded border ${isActive ? "bg-gradient-to-r from-black/10 to-transparent border-black/20" : "bg-black/5 border-black/10"}`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={`text-[8px] font-bold uppercase tracking-widest ${isActive ? "text-[#0062df]" : "text-muted-blue"}`}>
                  {isActive ? "Ends in" : "Ended"}
                </span>
                <span className="text-[9px] text-muted-blue">{formatDateTime(raffle.end_date)}</span>
              </div>
              {isActive && <CountdownTimer endDate={raffle.end_date} />}
              {isActive && (
                <p className="text-[9px] text-muted-blue/70 mt-1.5 leading-tight">
                  Ends early if all {raffle.max_participants.toLocaleString()} spots fill up.
                </p>
              )}
            </div>
          )}

          {/* 2. Title + description (left) with stats stacked on the right */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h3 className="text-lg font-header text-text-primary truncate">{raffle.title}</h3>
              <p className="text-muted-blue text-[11px] leading-snug mt-1 line-clamp-2">
                {raffle.description}
              </p>
            </div>
            <div className="flex-shrink-0 text-right space-y-1.5">
              <div>
                <p className="text-base font-display font-bold text-text-primary leading-none">
                  {raffle.participants_count.toLocaleString()}
                </p>
                <p className="text-[8px] font-bold uppercase text-muted-blue tracking-widest">Joined</p>
              </div>
              <div>
                <p className="text-sm font-display font-bold text-text-primary leading-none">
                  {raffle.tokens_required.toFixed(2)}
                </p>
                <p className="text-[8px] font-bold uppercase text-muted-blue tracking-widest">{tokenSymbol} entry</p>
              </div>
            </div>
          </div>

          {/* 3. Prize hero — what you win (replaces price) */}
          <div className="mt-auto pt-3 border-t border-black/10 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[8px] font-bold uppercase text-black/60 tracking-widest mb-0.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px] leading-none">emoji_events</span>
                You Win
              </p>
              <p className="text-base font-display font-bold text-text-primary truncate drop-shadow-[0_0_12px_rgba(26, 36, 52,0.35)]">
                {displayPrize}
                {extraPrizeCount > 0 && (
                  <span className="text-muted-blue text-[10px] font-bold ml-1 align-middle">+{extraPrizeCount} more</span>
                )}
              </p>
            </div>
            <button className="flex-shrink-0 px-3 py-1.5 bg-accent-warm hover:brightness-110 text-background font-bold rounded uppercase tracking-widest text-[9px] transition-all shadow-[0_0_15px_rgba(0,98,223,0.25)]">
              {isActive ? "Enter" : "View"}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
