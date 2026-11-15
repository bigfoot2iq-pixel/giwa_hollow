import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowUpRight, Coins, ImageIcon, Trophy } from "lucide-react";
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
  const ended = isEnded || backupRafflesThatAreEnded;

  return (
    <Link href={`${basePath}/${raffle.slug || raffle.id}`} className="group block">
      <article
        className={`art-frame flex h-full flex-col overflow-hidden rounded-[24px] transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_30px_60px_-36px_rgba(39,33,50,0.55)] dark:group-hover:shadow-[0_30px_60px_-26px_rgba(0,0,0,0.9)] ${
          ended ? "opacity-60" : ""
        }`}
      >
        <div
          className={`relative h-60 overflow-hidden ${
            isNFT ? "bg-lilac/25" : "flex items-center justify-center bg-[linear-gradient(135deg,#FFF8DE_0%,#FBE7EF_55%,#E4F0FB_100%)] dark:bg-[linear-gradient(135deg,#221c0f_0%,#2a1620_55%,#162230_100%)]"
          }`}
        >
          {raffle.image_url ? (
            <Image
              alt={raffle.title}
              fill
              className="object-contain p-2 transition-transform duration-700 group-hover:scale-[1.04]"
              src={raffle.image_url}
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : isNFT ? (
            <div className="flex size-full items-center justify-center">
              <ImageIcon className="size-12 text-ink-faint" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="flex size-14 items-center justify-center rounded-2xl border border-ink/10 bg-white/50 text-butter-ink dark:border-white/10 dark:bg-white/[0.06]">
                <Coins className="size-6" />
              </span>
              <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-ink-mute">
                token prize
              </span>
            </div>
          )}

          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-ink/10 bg-paper/85 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-ink-soft backdrop-blur">
              {typeLabel}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] backdrop-blur ${
                isActive
                  ? "border-success/25 bg-success-strong/90 text-white"
                  : ended
                    ? "border-ink/10 bg-paper/85 text-ink-mute"
                    : "border-iris/20 bg-iris-strong/90 text-white"
              }`}
            >
              {isActive && <span className="size-1.5 rounded-full bg-white" />}
              {isActive ? "Live" : raffle.status === "pending" ? "Upcoming" : "Ended"}
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-ink/[0.07] bg-cream/60 px-3 py-2">
            <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-mute">
              {isActive ? "Ends in" : raffle.status === "pending" ? "Starts in" : "Ended"}
            </span>
            {raffle.status === "pending" && raffle.start_date ? (
              <CountdownTimer endDate={raffle.start_date} />
            ) : isActive && raffle.end_date ? (
              <CountdownTimer endDate={raffle.end_date} />
            ) : (
              <span className="font-mono text-[9px] text-ink-mute">
                {raffle.end_date ? formatDateTime(raffle.end_date) : "—"}
              </span>
            )}
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-header text-lg font-extrabold tracking-[-0.03em] text-ink">
                {raffle.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-ink-mute">
                {raffle.description}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-header text-base font-extrabold leading-none text-ink">
                {raffle.participants_count.toLocaleString()}
              </p>
              <p className="mt-1 font-mono text-[7.5px] uppercase tracking-[0.14em] text-ink-mute">
                joined
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-2 border-t border-ink/[0.07] pt-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.14em] text-ink-mute">
                <Trophy className="size-2.5" />
                You win
              </p>
              <p className="mt-1 truncate font-header text-[15px] font-extrabold tracking-[-0.02em] text-ink">
                {displayPrize}
                {extraPrizeCount > 0 && (
                  <span className="ml-1 align-middle font-mono text-[8px] font-normal uppercase tracking-[0.1em] text-ink-mute">
                    +{extraPrizeCount} more
                  </span>
                )}
              </p>
              <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint">
                {raffle.tokens_required.toFixed(2)} {tokenSymbol} entry
              </p>
            </div>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-ink/10 text-ink-mute transition group-hover:border-iris/30 group-hover:bg-iris/10 group-hover:text-iris">
              <ArrowUpRight className="size-3.5" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
