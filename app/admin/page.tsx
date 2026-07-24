"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAccount, useSignMessage, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { format } from "date-fns";
import type { Raffle } from "@/lib/supabase";
import {
  useClaimCooldown,
  useClaimAmount,
  useClaimFee,
} from "@/lib/hooks";
import { contracts, AriwaTokenABI, THE_ARIWA_GAME_ADDRESS, THE_ARIWA_GAME_ABI } from "@/lib/contracts";

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

export default function AdminDashboard() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<RaffleScope>("all");
  const [offset, setOffset] = useState(0);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const authRef = useRef<{ wallet: string; signature: string; timestamp: string } | null>(null);
  const authPromiseRef = useRef<Promise<{ wallet: string; signature: string; timestamp: string }> | null>(null);
  const walletLower = address?.toLowerCase();
  const [activeTab, setActiveTab] = useState<"token" | "game" | "raffles">("token");

  const getAdminAuth = useCallback(async () => {
    if (!walletLower) {
      throw new Error("Wallet not connected");
    }

    const now = Date.now();
    const cached = authRef.current;
    if (cached && cached.wallet === walletLower && now - Number(cached.timestamp) < 5 * 60 * 1000) {
      return cached;
    }

    if (authPromiseRef.current) {
      return authPromiseRef.current;
    }

    const timestamp = now.toString();
    const message = `Katana Raffles Admin\nTimestamp: ${timestamp}`;

    authPromiseRef.current = signMessageAsync({ message })
      .then((signature) => {
        const auth = { wallet: walletLower, signature, timestamp };
        authRef.current = auth;
        authPromiseRef.current = null;
        return auth;
      })
      .catch((error) => {
        authPromiseRef.current = null;
        throw error;
      });

    return authPromiseRef.current;
  }, [walletLower, signMessageAsync]);

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
      }
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  }, [walletLower, getAdminAuth, scope, offset]);

  useEffect(() => {
    loadRaffles();
  }, [loadRaffles]);

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

  if (loading && !data) {
    return (
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="ui-container rounded h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  const total = data?.total || 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-5xl font-header text-foreground">Admin Dashboard</h2>
        <div className="flex items-center gap-3">
          <Link href="/admin/raffles/create">
            <button className="px-6 py-3 bg-accent-warm hover:brightness-110 text-background font-bold rounded uppercase tracking-widest text-sm transition-all shadow-[0_0_20px_rgba(0,98,223,0.25)] flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">add</span>
              Create Raffle
            </button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="ui-container p-6 rounded border-l-4 border-[#0062df]">
          <p className="text-muted-blue text-[10px] font-bold uppercase tracking-widest mb-2">Total Raffles</p>
          <p className="text-3xl font-display font-bold text-text-primary">{data?.stats?.total_raffles || 0}</p>
        </div>
        <div className="ui-container p-6 rounded">
          <p className="text-muted-blue text-[10px] font-bold uppercase tracking-widest mb-2">Active Raffles</p>
          <p className="text-3xl font-display font-bold text-text-primary">{data?.stats?.active_raffles || 0}</p>
        </div>
        <div className="ui-container p-6 rounded">
          <p className="text-muted-blue text-[10px] font-bold uppercase tracking-widest mb-2">Total Entries</p>
          <p className="text-3xl font-display font-bold text-text-primary">{data?.stats?.total_entries || 0}</p>
        </div>
        <div className="ui-container p-6 rounded">
          <p className="text-muted-blue text-[10px] font-bold uppercase tracking-widest mb-2">Total Users</p>
          <p className="text-3xl font-display font-bold text-text-primary">{data?.stats?.total_users || 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-black/10">
        {([
          { id: "token", label: "ARIWA Token Config" },
          { id: "game", label: "Game Config" },
          { id: "raffles", label: "Raffles" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? "text-foreground border-foreground"
                : "text-foreground/60 border-transparent hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ARIWA Token Config */}
      {activeTab === "token" && <AriwaTokenConfig />}

      {/* Game Play Fee Config */}
      {activeTab === "game" && <GameConfig />}

      {/* Raffles Table */}
      {activeTab === "raffles" && (
      <div className="ui-container rounded overflow-hidden">
        <div className="px-6 py-4 border-b border-black/10 flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-xl font-header text-text-primary">
            All Raffles {total > 0 && <span className="text-muted-blue text-sm font-normal">({total})</span>}
          </h3>
          <div className="flex gap-1 bg-black/5 rounded p-1">
            {([
              { id: "all", label: "All" },
              { id: "platform", label: "Platform" },
              { id: "community", label: "Community" },
            ] as const).map((s) => (
              <button
                key={s.id}
                onClick={() => changeScope(s.id)}
                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${
                  scope === s.id
                    ? "bg-accent-warm text-background border border-transparent"
                    : "text-muted-blue hover:text-[#0062df]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {data?.raffles && data.raffles.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead className="bg-black/5 border-b border-black/10">
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
            <tbody className="divide-y divide-black/10">
              {data.raffles.map((raffle) => (
                <tr key={raffle.id} className="hover:bg-black/5 transition-colors">
                  <td className="px-6 py-5">
                    <p className="font-bold text-text-primary">{raffle.title}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded border ${
                      raffle.is_community
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        : "bg-black/10 text-[#0062df] border-[#0062df]/20"
                    }`}>
                      {raffle.is_community ? "Community" : "Platform"}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded border ${
                      raffle.status === "active"
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : raffle.status === "pending"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : "bg-black/5 text-muted-blue border-black/10"
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
                          className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-500 text-xs font-bold rounded uppercase tracking-widest transition-all border border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading[`activate-${raffle.id}`] ? "..." : "Activate"}
                        </button>
                      )}
                      {raffle.status === "active" && (
                        <button
                          onClick={() => handleEndRaffle(raffle.id)}
                          disabled={actionLoading[`end-${raffle.id}`]}
                          className="px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-500 text-xs font-bold rounded uppercase tracking-widest transition-all border border-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading[`end-${raffle.id}`] ? "..." : "End"}
                        </button>
                      )}
                      <Link href={`/admin/raffles/${raffle.slug || raffle.id}`}>
                        <button className="px-4 py-2 bg-black/5 hover:bg-black/10 text-text-primary text-xs font-bold rounded uppercase tracking-widest transition-all border border-black/10">
                          Manage
                        </button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
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
          <div className="px-6 py-4 border-t border-black/10 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-muted-blue uppercase tracking-widest">
              Showing {pageStart}–{pageEnd} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={!hasPrev || loading}
                className="px-4 py-2 bg-black/5 hover:bg-black/10 text-text-primary text-xs font-bold rounded uppercase tracking-widest transition-all border border-black/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={!hasNext || loading}
                className="px-4 py-2 bg-black/5 hover:bg-black/10 text-text-primary text-xs font-bold rounded uppercase tracking-widest transition-all border border-black/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
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
    <div className="space-y-4 p-5 rounded-xl border border-black/10 bg-black/5 max-w-md">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-text-primary">Claim Config</h4>
        {isSuccess && <span className="text-[10px] text-green-400 font-bold">Saved!</span>}
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] text-muted-blue uppercase tracking-widest mb-1">Mint Amount (ARIWA)</label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1"
            className="w-full px-3 py-2.5 bg-black/5 border border-black/10 rounded text-text-primary text-sm focus:outline-none focus:border-[#0062df]/50 placeholder-black/30"
          />
        </div>
        <div>
          <label className="block text-[10px] text-muted-blue uppercase tracking-widest mb-1">Fee (ETH)</label>
          <input
            type="text"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2.5 bg-black/5 border border-black/10 rounded text-text-primary text-sm focus:outline-none focus:border-[#0062df]/50 placeholder-black/30"
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
      {error && <p className="text-red-400 text-xs">{error.message.split("\n")[0]}</p>}
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
      <div className="px-6 py-4 border-b border-black/10">
        <h3 className="text-xl font-header text-text-primary">ARIWA Token Config</h3>
        <p className="text-[11px] text-muted-blue mt-1">
          Set the mint amount and fee (in ETH) for a claim. Users pay the fee to mint tokens.
        </p>
      </div>

      {/* Claim config */}
      <div className="p-6 border-b border-black/10">
        <ClaimConfigField />
      </div>

      {/* Claim cooldown */}
      <div className="p-6">
        <div className="space-y-3 max-w-md">
          <div>
            <p className="text-muted-blue text-[10px] font-bold uppercase tracking-widest mb-1">Claim Cooldown (seconds)</p>
            <p className="text-[10px] text-muted-blue mb-1">Window between claims per address.</p>
            <p className="text-sm text-text-primary/60">
              Current: <span className="text-[#0062df] font-bold">{currentCooldown !== undefined ? `${Number(currentCooldown)}s (${formatCooldownDisplay(Number(currentCooldown))})` : "..."}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={cooldownInput}
              onChange={(e) => setCooldownInput(e.target.value)}
              placeholder="86400"
              min="0"
              className="flex-1 px-4 py-3 bg-black/5 border border-black/10 rounded text-text-primary text-sm focus:outline-none focus:border-[#0062df]/50 placeholder-black/30"
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
                    ? "bg-black/10 text-[#0062df] border-[#0062df]/30"
                    : "bg-black/5 text-muted-blue border-black/10 hover:bg-black/10"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {cooldownSuccess && <p className="text-green-400 text-xs">Cooldown updated successfully!</p>}
          {cooldownError && <p className="text-red-400 text-xs">{cooldownError.message.split("\n")[0]}</p>}
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
      <div className="px-6 py-4 border-b border-black/10">
        <h3 className="text-xl font-header text-text-primary">Game Config</h3>
      </div>
      <div className="p-6">
        <div className="space-y-3 max-w-md">
          <div>
            <p className="text-muted-blue text-[10px] font-bold uppercase tracking-widest mb-1">Play Fee (ARIWA)</p>
            <p className="text-sm text-text-primary/60">
              Current: <span className="text-[#0062df] font-bold">{currentFee !== undefined ? formatEther(currentFee as bigint) : "..."} ARIWA</span>
            </p>
            <p className="text-[10px] text-muted-blue mt-1">Amount of ARIWA each player pays to play. Must be greater than 0.</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={feeInput}
              onChange={(e) => setFeeInput(e.target.value)}
              placeholder="10"
              className="flex-1 px-4 py-3 bg-black/5 border border-black/10 rounded text-text-primary text-sm focus:outline-none focus:border-[#0062df]/50 placeholder-black/30"
            />
            <button
              onClick={handleSetFee}
              disabled={feePending || feeConfirming}
              className="px-4 py-3 bg-accent-warm hover:brightness-110 text-background font-bold rounded uppercase tracking-widest text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {feePending ? "Sign..." : feeConfirming ? "Confirming..." : "Update"}
            </button>
          </div>
          {feeSuccess && <p className="text-green-400 text-xs">Play fee updated successfully!</p>}
          {feeError && <p className="text-red-400 text-xs">{feeError.message.split('\n')[0]}</p>}
        </div>
      </div>
    </div>
  );
}
