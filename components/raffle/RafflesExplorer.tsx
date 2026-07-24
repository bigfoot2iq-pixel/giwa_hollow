"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { RaffleCard, type CardPrize } from "./RaffleCard";
import { CreateRaffleModal } from "./CreateRaffleModal";
import type { PrizeType, Raffle, RaffleStatus } from "@/lib/supabase";

const statusFilters: { label: string; value: RaffleStatus | "all" }[] = [
  { label: "All Raffles", value: "all" },
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
  /** platform = owner raffles, community = user-created raffles */
  scope: "platform" | "community";
  title: string;
  /** Show the "Create Raffle" action (creates a community/user raffle). */
  showCreate?: boolean;
  emptyHint?: string;
}

export function RafflesExplorer({ scope, title, showCreate = false, emptyHint }: RafflesExplorerProps) {
  const { isConnected } = useAccount();
  const [raffles, setRaffles] = useState<RaffleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RaffleStatus | "all">("all");
  const [total, setTotal] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchRaffles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("scope", scope);
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
  }, [filter, scope]);

  useEffect(() => {
    fetchRaffles();
  }, [fetchRaffles]);

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 lg:mb-8">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-header text-foreground">{title}</h2>
        {showCreate && isConnected && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-warm hover:brightness-110 text-background font-bold rounded uppercase tracking-widest text-xs transition-all shadow-[0_0_20px_rgba(0,98,223,0.25)]"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Create Raffle
          </button>
        )}
      </div>

      {/* Timing explainer */}
      {scope === "community" && (
      <div className="ui-container rounded border border-[#0062df]/20 bg-gradient-to-r from-[#0062df]/10 to-transparent p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-[#0062df] text-xl shrink-0">schedule</span>
          <div className="space-y-1">
            <p className="text-xs sm:text-sm font-bold text-text-primary uppercase tracking-widest">
              How raffle timing works
            </p>
            <ul className="text-[11px] sm:text-xs text-muted-blue leading-relaxed list-disc pl-4 space-y-0.5">
              <li>
                Each raffle ends when its countdown hits <span className="text-text-primary font-semibold">zero</span> — or earlier if every spot fills up.
              </li>
              <li>
                Winners are drawn <span className="text-text-primary font-semibold">automatically on-chain within ~1 minute</span> of a raffle ending.
              </li>
              <li>
                The countdown and all dates are shown in <span className="text-text-primary font-semibold">your local timezone</span>.
              </li>
            </ul>
          </div>
        </div>
      </div>
      )}

      {/* Filter Tabs */}
      <div className="flex overflow-x-auto border-b border-black/10 gap-4 sm:gap-6 lg:gap-8 mb-6 lg:mb-8 pb-px">
        {statusFilters.map((status) => (
          <button
            key={status.value}
            onClick={() => setFilter(status.value)}
            className={`pb-3 sm:pb-4 px-2 text-xs sm:text-sm font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${
              filter === status.value
                ? "text-foreground border-b-2 border-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {status.label}
          </button>
        ))}
      </div>

      {/* Raffles Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="ui-container rounded h-72 sm:h-80 animate-pulse" />
          ))}
        </div>
      ) : raffles.length === 0 ? (
        <div className="ui-container rounded p-12 sm:p-16 text-center">
          <span className="material-symbols-outlined text-muted-blue text-5xl sm:text-6xl mb-4 block">confirmation_number</span>
          <p className="text-base sm:text-lg text-muted-blue">No raffles found</p>
          <p className="text-xs sm:text-sm text-muted-blue/60 mt-2">{emptyHint || "Check back soon for new raffles!"}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
            {raffles.map((raffle) => (
              <RaffleCard key={raffle.id} raffle={raffle} basePath={scope === "community" ? "/community-raffles" : "/raffles"} />
            ))}
          </div>
          {total > raffles.length && (
            <div className="text-center mt-6 lg:mt-8">
              <button className="px-5 sm:px-6 py-2.5 sm:py-3 bg-black/5 hover:bg-black/10 text-foreground font-bold rounded uppercase tracking-widest text-xs sm:text-sm transition-all border border-black/20">
                Load More
              </button>
            </div>
          )}
        </>
      )}

      {showCreateModal && (
        <CreateRaffleModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => fetchRaffles()}
        />
      )}
    </div>
  );
}
