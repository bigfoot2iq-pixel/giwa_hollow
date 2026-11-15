"use client";

import { useCallback, useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { RaffleCard, type CardPrize } from "./RaffleCard";
import type { PrizeType, Raffle, RaffleStatus } from "@/lib/supabase";

const statusFilters: { label: string; value: RaffleStatus | "all" }[] = [
  { label: "All raffles", value: "all" },
  { label: "Live", value: "active" },
  { label: "Upcoming", value: "pending" },
  { label: "Historical", value: "ended" },
];

type RaffleSummary = Raffle & {
  status: RaffleStatus;
  prize_types: PrizeType[];
  prizes: CardPrize[];
  participants_count: number;
};

interface RafflesExplorerProps {
  title: string;
  emptyHint?: string;
}

export function RafflesExplorer({ title, emptyHint }: RafflesExplorerProps) {
  const [raffles, setRaffles] = useState<RaffleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RaffleStatus | "all">("all");
  const [total, setTotal] = useState(0);

  const fetchRaffles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("scope", "platform");
      if (filter !== "all") {
        params.set("status", filter);
      }
      params.set("limit", "20");

      const response = await fetch(`/api/raffles?${params}`);
      const data = await response.json();

      if (response.ok) {
        setRaffles(data.raffles);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Error fetching raffles:", error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchRaffles();
  }, [fetchRaffles]);

  return (
    <div className="page-shell">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">The drawing room</p>
          <h1 className="display mt-4 text-[clamp(2.2rem,5vw,3.6rem)] text-ink">{title}</h1>
          <p className="mt-3 max-w-xl text-[13px] leading-6 text-ink-soft">
            Platform raffles with fixed odds and on-chain draws. Pick a ticket, take a chance, keep the prize.
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-ink/[0.08] bg-paper/55 p-1">
          {statusFilters.map((status) => (
            <button
              key={status.value}
              onClick={() => setFilter(status.value)}
              className={`rounded-full px-3.5 py-2 text-[11px] font-semibold transition-colors sm:text-[12px] ${
                filter === status.value
                  ? "bg-ink text-cream shadow-[0_6px_14px_-8px_rgba(39,33,50,0.7)]"
                  : "text-ink-soft hover:bg-ink/[0.05] hover:text-ink"
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">
          {total} {total === 1 ? "raffle" : "raffles"} in this room
        </p>
      </div>

      {loading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="ui-container h-80 animate-pulse rounded-[24px]" />
          ))}
        </div>
      ) : raffles.length === 0 ? (
        <div className="ui-container mt-6 rounded-[26px] p-12 text-center sm:p-16">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-iris/[0.07] text-iris">
            <Ticket className="size-6" />
          </span>
          <p className="mt-4 font-header text-xl font-extrabold tracking-[-0.03em] text-ink">
            No raffles in this room yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-[12px] leading-6 text-ink-mute">
            {emptyHint || "Check back soon for new raffles."}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {raffles.map((raffle) => (
              <RaffleCard key={raffle.id} raffle={raffle} />
            ))}
          </div>
          {total > raffles.length && (
            <div className="mt-8 text-center">
              <button className="btn-soft h-11 px-5 text-[11px]">Load more</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
