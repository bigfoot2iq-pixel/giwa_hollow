"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { format } from "date-fns";
import type { Raffle } from "@/lib/supabase";
import {
  useClaimCooldown,
  useClaimAmount,
  useClaimFee,
} from "@/lib/hooks";
import { useAdminAuth } from "@/lib/hooks/useAdminAuth";
import { contracts, AriwaTokenABI, THE_ARIWA_GAME_ADDRESS, THE_ARIWA_GAME_ABI } from "@/lib/contracts";
import { RafflesMaintenanceToggle } from "@/components/admin/RafflesMaintenanceToggle";
import { LaunchpadSettings } from "@/components/admin/LaunchpadSettings";
import { LaunchpadRequests } from "@/components/admin/LaunchpadRequests";
import { SwapPoolSettings } from "@/components/admin/SwapPoolSettings";

interface AdminData {
  raffles: Array<
    Raffle & {
      participants_count?: number;
      prize_types?: string[];
      status: string;
      is_community?: boolean;
    }
  >;
  total: number;
  stats: {
    total_raffles: number;
    active_raffles: number;
    total_entries: number;
    total_users: number;
  } | null;
}

type RaffleScope = "all" | "platform" | "community";
const PAGE_SIZE = 20;

type AdminTab = "launchpad" | "trade" | "token" | "game" | "raffles";

const ADMIN_TABS = [
  { id: "launchpad", label: "Launchpad", icon: "rocket_launch" },
  { id: "trade", label: "Swap pool", icon: "swap_horiz" },
  { id: "token", label: "ARIWA token", icon: "toll" },
  { id: "game", label: "Game", icon: "sports_esports" },
  { id: "raffles", label: "Raffles", icon: "confirmation_number" },
] as const;

export default function AdminDashboard() {
  const { getAdminAuth, wallet: walletLower } = useAdminAuth();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<RaffleScope>("all");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  // The launchpad is the default view; raffle data (and its admin signature
  // prompt) only loads once the raffles tab is opened.
  const [activeTab, setActiveTab] = useState<AdminTab>("launchpad");

  const loadRaffles = useCallback(async () => {
    if (!walletLower) return;
    setLoading(true);

    try {
      const auth = await getAdminAuth();

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (scope !== "all") params.set("scope", scope);

      const response = await fetch(`/api/admin/raffles?${params.toString()}`, {
        headers: {
          "x-admin-wallet": auth.wallet,
          "x-admin-signature": auth.signature,
          "x-admin-timestamp": auth.timestamp,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
        setLoadError(null);
      } else {
        // A failed load used to fall through silently and render as "no raffles
        // created yet", which is indistinguishable from an empty table.
        const detail = await response.json().catch(() => ({}));
        setLoadError(
          response.status === 401
            ? "Admin signature rejected. Reconnect the admin wallet and re-sign."
            : detail?.error || `Failed to load raffles (HTTP ${response.status})`
        );
      }
    } catch (error) {
      console.error("Error fetching admin data:", error);
      setLoadError(error instanceof Error ? error.message : "Failed to load raffles");
    } finally {
      setLoading(false);
    }
  }, [walletLower, getAdminAuth, scope, offset]);

  useEffect(() => {
    if (activeTab !== "raffles") return;
    loadRaffles();
  }, [activeTab, loadRaffles]);

  const changeScope = (next: RaffleScope) => {
    setScope(next);
    setOffset(0);
  };

  const handleActivateRaffle = async (raffleId: string) => {
    if (!walletLower) return;
    
    setActionLoading((prev) => ({ ...prev, [`activate-${raffleId}`]: true }));
    
    try {
      const auth = await getAdminAuth();
      
      const response = await fetch(`/api/admin/raffles/${raffleId}/activate`, {
        method: "POST",
        headers: {
          "x-admin-wallet": auth.wallet,
          "x-admin-signature": auth.signature,
          "x-admin-timestamp": auth.timestamp,
        },
      });

      if (response.ok) {
        alert("Raffle activated successfully!");
        await loadRaffles();
      } else {
        const error = await response.json();
        alert(`Failed to activate raffle: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error activating raffle:", error);
      alert("Failed to activate raffle");
    } finally {
      setActionLoading((prev) => ({ ...prev, [`activate-${raffleId}`]: false }));
    }
  };

  const handleEndRaffle = async (raffleId: string) => {
    if (!walletLower) return;
    
    if (!confirm("Are you sure you want to end this raffle? This will select winners and cannot be undone.")) {
      return;
    }
    
    setActionLoading((prev) => ({ ...prev, [`end-${raffleId}`]: true }));
    
    try {
      const auth = await getAdminAuth();
      
      const response = await fetch(`/api/admin/raffles/${raffleId}/end`, {
        method: "POST",
        headers: {
          "x-admin-wallet": auth.wallet,
          "x-admin-signature": auth.signature,
          "x-admin-timestamp": auth.timestamp,
        },
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Raffle ended successfully! ${result.winners.length} winner(s) selected from ${result.participantCount} participant(s).`);
        await loadRaffles();
      } else {
        const error = await response.json();
        alert(`Failed to end raffle: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error ending raffle:", error);
      alert("Failed to end raffle");
    } finally {
      setActionLoading((prev) => ({ ...prev, [`end-${raffleId}`]: false }));
    }
  };

  const handleCancelRaffle = async (raffleId: string) => {
    if (!walletLower) return;

    if (
      !confirm(
        "Cancel this raffle on-chain? The escrowed prize is returned to its creator (or the platform owner), no winner is drawn, and this cannot be undone."
      )
    ) {
      return;
    }

    setActionLoading((prev) => ({ ...prev, [`cancel-${raffleId}`]: true }));

    try {
      const auth = await getAdminAuth();

      const response = await fetch(`/api/admin/raffles/${raffleId}/cancel`, {
        method: "POST",
        headers: {
          "x-admin-wallet": auth.wallet,
          "x-admin-signature": auth.signature,
          "x-admin-timestamp": auth.timestamp,
        },
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Raffle cancelled. Prize returned to ${result.recipient}.`);
        await loadRaffles();
      } else {
        const error = await response.json();
        alert(`Failed to cancel raffle: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error cancelling raffle:", error);
      alert("Failed to cancel raffle");
    } finally {
      setActionLoading((prev) => ({ ...prev, [`cancel-${raffleId}`]: false }));
    }
  };

  const total = data?.total || 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  return (
    <div className="page-shell space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Owner&apos;s console</p>
          <h1 className="display mt-4 text-[clamp(2.2rem,5vw,3.6rem)] text-ink">
            Admin dashboard
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-6 text-ink-soft">
            The launchpad, the swap pool, the ARIWA token, the game and the
            raffles in one quiet back room.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/admin/raffles/create" className="btn-iris h-11 px-4 text-[11px]">
            <span className="material-symbols-outlined text-base">add</span>
            Create raffle
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-ink/[0.08] bg-paper/55 p-1">
        {ADMIN_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-semibold transition-colors ${
              activeTab === tab.id
                ? "bg-ink text-cream shadow-[0_6px_14px_-8px_rgba(39,33,50,0.7)]"
                : "text-ink-soft hover:bg-ink/[0.05] hover:text-ink"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Launchpad */}
      {activeTab === "launchpad" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-header text-2xl font-extrabold tracking-[-0.03em] text-ink">
                NFT Launchpad
              </h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-6 text-ink-soft">
                Control the public mint phase, pricing, per-wallet cap and holder
                gate, mint to any wallet, then review community collection
                requests.
              </p>
            </div>
            <Link
              href="/launchpad"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-soft h-11 px-4 text-[11px]"
            >
              <span className="material-symbols-outlined text-base">open_in_new</span>
              View public page
            </Link>
          </div>

          <LaunchpadSettings />
          <LaunchpadRequests />
        </div>
      )}

      {/* Swap pool */}
      {activeTab === "trade" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-header text-2xl font-extrabold tracking-[-0.03em] text-ink">
                Swap pool
              </h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-6 text-ink-soft">
                Change the swap fee, top up liquidity, pause or resume trading,
                and withdraw the pool&apos;s ETH or ARIWA reserves. Prices follow
                the x × y = k curve automatically.
              </p>
            </div>
            <Link
              href="/trade"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-soft h-11 px-4 text-[11px]"
            >
              <span className="material-symbols-outlined text-base">open_in_new</span>
              View public page
            </Link>
          </div>

          <SwapPoolSettings />
        </div>
      )}

      {/* ARIWA Token Config */}
      {activeTab === "token" && <AriwaTokenConfig />}

      {/* Game Play Fee Config */}
      {activeTab === "game" && <GameConfig />}

      {/* Raffles */}
      {activeTab === "raffles" && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="ui-container rounded-[22px] border-l-2 border-l-iris p-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">Total raffles</p>
              <p className="mt-2 font-header text-3xl font-extrabold tracking-[-0.04em] text-ink">{data?.stats?.total_raffles || 0}</p>
            </div>
            <div className="ui-container rounded-[22px] p-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">Active raffles</p>
              <p className="mt-2 font-header text-3xl font-extrabold tracking-[-0.04em] text-ink">{data?.stats?.active_raffles || 0}</p>
            </div>
            <div className="ui-container rounded-[22px] p-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">Total entries</p>
              <p className="mt-2 font-header text-3xl font-extrabold tracking-[-0.04em] text-ink">{data?.stats?.total_entries || 0}</p>
            </div>
            <div className="ui-container rounded-[22px] p-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">Total users</p>
              <p className="mt-2 font-header text-3xl font-extrabold tracking-[-0.04em] text-ink">{data?.stats?.total_users || 0}</p>
            </div>
          </div>

          <div className="ui-container overflow-hidden rounded-[26px]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/[0.08] px-6 py-4">
              <h3 className="font-header text-lg font-extrabold tracking-[-0.03em] text-ink">
                All raffles {total > 0 && <span className="font-mono text-[10px] font-normal text-ink-mute">({total})</span>}
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <RafflesMaintenanceToggle />
                <div className="flex gap-1 rounded-full bg-ink/[0.04] p-1">
                  {([
                    { id: "all", label: "All" },
                    { id: "platform", label: "Platform" },
                    { id: "community", label: "Community" },
                  ] as const).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => changeScope(s.id)}
                      className={`rounded-full px-3.5 py-1.5 text-[10px] font-semibold transition-all ${
                        scope === s.id
                          ? "bg-ink text-cream"
                          : "text-ink-mute hover:text-ink"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          {loadError && (
            <div className="px-6 py-4 border-b border-red-500/20 bg-red-500/10 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-red-600 dark:text-red-300">{loadError}</p>
              <button
                onClick={() => loadRaffles()}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-300 text-xs font-bold rounded uppercase tracking-widest transition-all border border-red-500/30"
              >
                Retry
              </button>
            </div>
          )}
          {loading && !data ? (
            <div className="space-y-3 p-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-ink/[0.06]" />
              ))}
            </div>
          ) : data?.raffles && data.raffles.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead className="bg-ink/[0.04] border-b border-ink/10">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-blue">Title</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-blue">Source</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-blue">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-blue">Type</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-blue">Participants</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-blue">End Date</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-blue text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {data.raffles.map((raffle) => (
                  <tr key={raffle.id} className="hover:bg-ink/[0.04] transition-colors">
                    <td className="px-6 py-5">
                      <p className="font-bold text-text-primary">{raffle.title}</p>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded border ${
                        raffle.is_community
                          ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                          : "bg-ink/[0.07] text-iris border-iris/20"
                      }`}>
                        {raffle.is_community ? "Community" : "Platform"}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded border ${
                        raffle.status === "active"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                          : raffle.status === "pending"
                          ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                          : "bg-ink/[0.04] text-muted-blue border-ink/10"
                      }`}>
                        {raffle.status}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm text-text-primary capitalize">
                        {raffle.prize_types && raffle.prize_types.length > 0
                          ? raffle.prize_types.length === 1
                            ? raffle.prize_types[0]
                            : "multiple"
                          : "unknown"}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-display font-bold text-text-primary">
                        {(raffle.participants_count || 0)}/{raffle.max_participants}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm text-text-primary">{format(new Date(raffle.end_date), "MMM d, yyyy")}</p>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {raffle.status === "pending" && (
                          <button
                            onClick={() => handleActivateRaffle(raffle.id)}
                            disabled={actionLoading[`activate-${raffle.id}`]}
                            className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded uppercase tracking-widest transition-all border border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {actionLoading[`activate-${raffle.id}`] ? "..." : "Activate"}
                          </button>
                        )}
                        {raffle.status === "active" && (
                          <button
                            onClick={() => handleEndRaffle(raffle.id)}
                            disabled={actionLoading[`end-${raffle.id}`]}
                            className="px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-700 dark:text-orange-300 text-xs font-bold rounded uppercase tracking-widest transition-all border border-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {actionLoading[`end-${raffle.id}`] ? "..." : "End"}
                          </button>
                        )}
                        {(raffle.status === "active" || raffle.status === "pending") && raffle.chain_raffle_id != null && (
                          <button
                            onClick={() => handleCancelRaffle(raffle.id)}
                            disabled={actionLoading[`cancel-${raffle.id}`]}
                            title="Cancel on-chain and return the escrowed prize. No winner is drawn. Not time-locked."
                            className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-300 text-xs font-bold rounded uppercase tracking-widest transition-all border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {actionLoading[`cancel-${raffle.id}`] ? "..." : "Cancel"}
                          </button>
                        )}
                        <Link href={`/admin/raffles/${raffle.slug || raffle.id}`}>
                          <button className="px-4 py-2 bg-ink/[0.04] hover:bg-ink/[0.07] text-text-primary text-xs font-bold rounded uppercase tracking-widest transition-all border border-ink/10">
                            Manage
                          </button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : loadError ? null : (
            <div className="p-8 text-center">
              <span className="material-symbols-outlined text-muted-blue text-4xl mb-2 block">confirmation_number</span>
              <p className="text-muted-blue">
                {scope === "community"
                  ? "No community raffles yet"
                  : scope === "platform"
                  ? "No platform raffles yet"
                  : "No raffles created yet"}
              </p>
            </div>
          )}
          {total > 0 && (
            <div className="px-6 py-4 border-t border-ink/10 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-muted-blue uppercase tracking-widest">
                Showing {pageStart}–{pageEnd} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                  disabled={!hasPrev || loading}
                  className="px-4 py-2 bg-ink/[0.04] hover:bg-ink/[0.07] text-text-primary text-xs font-bold rounded uppercase tracking-widest transition-all border border-ink/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <button
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                  disabled={!hasNext || loading}
                  className="px-4 py-2 bg-ink/[0.04] hover:bg-ink/[0.07] text-text-primary text-xs font-bold rounded uppercase tracking-widest transition-all border border-ink/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

function ClaimConfigField() {
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");

  const { data: currentAmount } = useClaimAmount();
  const { data: currentFee } = useClaimFee();

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (currentAmount !== undefined && !amount) setAmount(formatEther(currentAmount as bigint));
  }, [currentAmount, amount]);

  useEffect(() => {
    if (currentFee !== undefined && !fee) setFee(formatEther(currentFee as bigint));
  }, [currentFee, fee]);

  const handleSave = () => {
    reset();
    let amountWei: bigint;
    let feeWei: bigint;
    try {
      amountWei = parseEther(amount);
      feeWei = parseEther(fee);
    } catch {
      alert("Invalid values");
      return;
    }
    if (currentAmount !== undefined && amountWei !== (currentAmount as bigint)) {
      writeContract({
        address: contracts.ariwaToken.address,
        abi: AriwaTokenABI,
        functionName: "setClaimAmount",
        args: [amountWei],
      });
    }
    if (currentFee !== undefined && feeWei !== (currentFee as bigint)) {
      writeContract({
        address: contracts.ariwaToken.address,
        abi: AriwaTokenABI,
        functionName: "setClaimFee",
        args: [feeWei],
      });
    }
  };

  return (
    <div className="space-y-4 p-5 rounded-xl border border-ink/10 bg-ink/[0.04] max-w-md">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-text-primary">Claim Config</h4>
        {isSuccess && <span className="text-[10px] text-green-700 dark:text-green-300 font-bold">Saved!</span>}
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] text-muted-blue uppercase tracking-widest mb-1">Mint Amount (ARIWA)</label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1"
            className="w-full px-3 py-2.5 bg-ink/[0.04] border border-ink/10 rounded text-text-primary text-sm focus:outline-none focus:border-iris/50 placeholder-ink-faint"
          />
        </div>
        <div>
          <label className="block text-[10px] text-muted-blue uppercase tracking-widest mb-1">Fee (ETH)</label>
          <input
            type="text"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2.5 bg-ink/[0.04] border border-ink/10 rounded text-text-primary text-sm focus:outline-none focus:border-iris/50 placeholder-ink-faint"
          />
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={isPending || confirming}
        className="w-full px-4 py-2.5 bg-accent-warm hover:brightness-110 text-background font-bold rounded uppercase tracking-widest text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Sign..." : confirming ? "Confirming..." : "Save Claim Config"}
      </button>
      {error && <p className="text-red-600 dark:text-red-300 text-xs">{error.message.split("\n")[0]}</p>}
    </div>
  );
}

function AriwaTokenConfig() {
  const { address } = useAccount();
  const { data: currentCooldown } = useClaimCooldown();

  const [cooldownInput, setCooldownInput] = useState("");

  const {
    writeContract: writeCooldown,
    data: cooldownHash,
    isPending: cooldownPending,
    error: cooldownError,
    reset: resetCooldown,
  } = useWriteContract();
  const { isLoading: cooldownConfirming, isSuccess: cooldownSuccess } = useWaitForTransactionReceipt({ hash: cooldownHash });

  useEffect(() => {
    if (currentCooldown !== undefined && !cooldownInput) {
      setCooldownInput(Number(currentCooldown).toString());
    }
  }, [currentCooldown, cooldownInput]);

  const handleSetCooldown = () => {
    resetCooldown();
    const seconds = parseInt(cooldownInput, 10);
    if (isNaN(seconds) || seconds < 0) {
      alert("Invalid cooldown value");
      return;
    }
    writeCooldown({
      address: contracts.ariwaToken.address,
      abi: AriwaTokenABI,
      functionName: "setClaimCooldown",
      args: [BigInt(seconds)],
    });
  };

  const formatCooldownDisplay = (seconds: number): string => {
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div className="ui-container rounded overflow-hidden">
      <div className="px-6 py-4 border-b border-ink/10">
        <h3 className="text-xl font-header text-text-primary">ARIWA Token Config</h3>
        <p className="text-[11px] text-muted-blue mt-1">
          Set the mint amount and fee (in ETH) for a claim. Users pay the fee to mint tokens.
        </p>
      </div>

      {/* Claim config */}
      <div className="p-6 border-b border-ink/10">
        <ClaimConfigField />
      </div>

      {/* Claim cooldown */}
      <div className="p-6">
        <div className="space-y-3 max-w-md">
          <div>
            <p className="text-muted-blue text-[10px] font-bold uppercase tracking-widest mb-1">Claim Cooldown (seconds)</p>
            <p className="text-[10px] text-muted-blue mb-1">Window between claims per address.</p>
            <p className="text-sm text-text-primary/60">
              Current: <span className="text-iris font-bold">{currentCooldown !== undefined ? `${Number(currentCooldown)}s (${formatCooldownDisplay(Number(currentCooldown))})` : "..."}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={cooldownInput}
              onChange={(e) => setCooldownInput(e.target.value)}
              placeholder="86400"
              min="0"
              className="flex-1 px-4 py-3 bg-ink/[0.04] border border-ink/10 rounded text-text-primary text-sm focus:outline-none focus:border-iris/50 placeholder-ink-faint"
            />
            <button
              onClick={handleSetCooldown}
              disabled={cooldownPending || cooldownConfirming}
              className="px-4 py-3 bg-accent-warm hover:brightness-110 text-background font-bold rounded uppercase tracking-widest text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cooldownPending ? "Sign..." : cooldownConfirming ? "Confirming..." : "Update"}
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "5m", value: "300" },
              { label: "30m", value: "1800" },
              { label: "1h", value: "3600" },
              { label: "6h", value: "21600" },
              { label: "12h", value: "43200" },
              { label: "24h", value: "86400" },
            ].map((preset) => (
              <button
                key={preset.value}
                onClick={() => setCooldownInput(preset.value)}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded border transition-all ${
                  cooldownInput === preset.value
                    ? "bg-ink/[0.07] text-iris border-iris/30"
                    : "bg-ink/[0.04] text-muted-blue border-ink/10 hover:bg-ink/[0.07]"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {cooldownSuccess && <p className="text-green-700 dark:text-green-300 text-xs">Cooldown updated successfully!</p>}
          {cooldownError && <p className="text-red-600 dark:text-red-300 text-xs">{cooldownError.message.split("\n")[0]}</p>}
        </div>
      </div>
    </div>
  );
}

function GameConfig() {
  const { data: currentFee } = useReadContract({
    address: THE_ARIWA_GAME_ADDRESS,
    abi: THE_ARIWA_GAME_ABI,
    functionName: "getPlayPrice",
  });

  const [feeInput, setFeeInput] = useState("");

  const {
    writeContract: writeFee,
    data: feeHash,
    isPending: feePending,
    error: feeError,
    reset: resetFee,
  } = useWriteContract();
  const { isLoading: feeConfirming, isSuccess: feeSuccess } = useWaitForTransactionReceipt({ hash: feeHash });

  // Pre-fill input with the current on-chain fee
  useEffect(() => {
    if (currentFee !== undefined && !feeInput) {
      setFeeInput(formatEther(currentFee as bigint));
    }
  }, [currentFee, feeInput]);

  const handleSetFee = () => {
    resetFee();
    try {
      const wei = parseEther(feeInput);
      if (wei <= 0n) {
        alert("Fee must be greater than 0");
        return;
      }
      writeFee({
        address: THE_ARIWA_GAME_ADDRESS,
        abi: THE_ARIWA_GAME_ABI,
        functionName: "setPlayPrice",
        args: [wei],
      });
    } catch {
      alert("Invalid fee value");
    }
  };

  return (
    <div className="ui-container rounded overflow-hidden">
      <div className="px-6 py-4 border-b border-ink/10">
        <h3 className="text-xl font-header text-text-primary">Game Config</h3>
      </div>
      <div className="p-6">
        <div className="space-y-3 max-w-md">
          <div>
            <p className="text-muted-blue text-[10px] font-bold uppercase tracking-widest mb-1">Play Fee (ARIWA)</p>
            <p className="text-sm text-text-primary/60">
              Current: <span className="text-iris font-bold">{currentFee !== undefined ? formatEther(currentFee as bigint) : "..."} ARIWA</span>
            </p>
            <p className="text-[10px] text-muted-blue mt-1">Amount of ARIWA each player pays to play. Must be greater than 0.</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={feeInput}
              onChange={(e) => setFeeInput(e.target.value)}
              placeholder="10"
              className="flex-1 px-4 py-3 bg-ink/[0.04] border border-ink/10 rounded text-text-primary text-sm focus:outline-none focus:border-iris/50 placeholder-ink-faint"
            />
            <button
              onClick={handleSetFee}
              disabled={feePending || feeConfirming}
              className="px-4 py-3 bg-accent-warm hover:brightness-110 text-background font-bold rounded uppercase tracking-widest text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {feePending ? "Sign..." : feeConfirming ? "Confirming..." : "Update"}
            </button>
          </div>
          {feeSuccess && <p className="text-green-700 dark:text-green-300 text-xs">Play fee updated successfully!</p>}
          {feeError && <p className="text-red-600 dark:text-red-300 text-xs">{feeError.message.split('\n')[0]}</p>}
        </div>
      </div>
    </div>
  );
}
