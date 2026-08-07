"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount, useSignMessage } from "wagmi";
import { format } from "date-fns";
import Link from "next/link";
import type { Raffle } from "@/lib/supabase";
import { getRaffleStatus } from "@/lib/utils/raffles";

interface RaffleDetail {
  raffle: Raffle;
  entries: Array<{
    id: string;
    wallet_address: string;
    tokens_spent: number;
    created_at: string;
  }>;
  winners: Array<{
    id: string;
    wallet_address: string;
    prize_id: string | null;
    created_at: string;
  }>;
  prizes: Array<{
    id: string;
    prize_type: string;
    prize_token_address: string;
    prize_amount: string | null;
    prize_token_id: string | null;
  }>;
  chainStatus?: string;
  // Unix seconds the contract locks endRaffle until. 0/undefined = endable now.
  chainEndTime?: number;
}

export default function RaffleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [data, setData] = useState<RaffleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [showManualEnd, setShowManualEnd] = useState(false);
  const [manualParticipants, setManualParticipants] = useState<Array<{ address: string; tickets: number }>>([
    { address: "", tickets: 1 },
  ]);
  const authRef = useRef<{ wallet: string; signature: string; timestamp: string } | null>(null);
  const authPromiseRef = useRef<Promise<{ wallet: string; signature: string; timestamp: string }> | null>(null);
  const walletLower = address?.toLowerCase();
  const raffleId = params.id as string;

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
    const message = `GIWA Raffles Admin\nTimestamp: ${timestamp}`;

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

  const fetchData = useCallback(async () => {
    if (!walletLower) return;
    setLoading(true);

    try {
      const auth = await getAdminAuth();

      const response = await fetch(`/api/admin/raffles/${raffleId}`, {
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
      console.error("Error fetching raffle data:", error);
    } finally {
      setLoading(false);
    }
  }, [walletLower, getAdminAuth, raffleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleActivateRaffle = async () => {
    if (!walletLower) return;
    
    setActionLoading((prev) => ({ ...prev, activate: true }));
    
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
        await fetchData();
      } else {
        const error = await response.json();
        alert(`Failed to activate raffle: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error activating raffle:", error);
      alert("Failed to activate raffle");
    } finally {
      setActionLoading((prev) => ({ ...prev, activate: false }));
    }
  };

  const handleEndRaffle = async () => {
    if (!walletLower) return;
    
    if (!confirm("Are you sure you want to end this raffle? This will select winners and cannot be undone.")) {
      return;
    }
    
    setActionLoading((prev) => ({ ...prev, end: true }));
    
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
        await fetchData();
      } else {
        const error = await response.json();
        alert(`Failed to end raffle: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error ending raffle:", error);
      alert("Failed to end raffle");
    } finally {
      setActionLoading((prev) => ({ ...prev, end: false }));
    }
  };

  const handleCancelRaffle = async () => {
    if (!walletLower) return;

    if (
      !confirm(
        "Cancel this raffle on-chain? The escrowed prize is returned to its creator (or the platform owner), no winner is drawn, and this cannot be undone."
      )
    ) {
      return;
    }

    setActionLoading((prev) => ({ ...prev, cancel: true }));

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
        await fetchData();
      } else {
        const error = await response.json();
        alert(`Failed to cancel raffle: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error cancelling raffle:", error);
      alert("Failed to cancel raffle");
    } finally {
      setActionLoading((prev) => ({ ...prev, cancel: false }));
    }
  };

  const handleManualEndRaffle = async () => {
    if (!walletLower) return;

    const validParticipants = manualParticipants.filter(
      (p) => p.address.trim() !== "" && p.tickets > 0
    );

    if (validParticipants.length === 0) {
      alert("Please add at least one participant with a valid address and ticket count.");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to manually end this raffle with ${validParticipants.length} custom participant(s)? This cannot be undone.`
      )
    ) {
      return;
    }

    setActionLoading((prev) => ({ ...prev, manualEnd: true }));

    try {
      const auth = await getAdminAuth();

      const response = await fetch(`/api/admin/raffles/${raffleId}/manual-end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-wallet": auth.wallet,
          "x-admin-signature": auth.signature,
          "x-admin-timestamp": auth.timestamp,
        },
        body: JSON.stringify({ participants: validParticipants }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(
          `Raffle manually ended! ${result.winners.length} winner(s) selected from ${result.participantCount} participant(s).`
        );
        setShowManualEnd(false);
        setManualParticipants([{ address: "", tickets: 1 }]);
        await fetchData();
      } else {
        const error = await response.json();
        alert(`Failed to manually end raffle: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error manually ending raffle:", error);
      alert("Failed to manually end raffle");
    } finally {
      setActionLoading((prev) => ({ ...prev, manualEnd: false }));
    }
  };

  const addParticipantRow = () => {
    setManualParticipants((prev) => [...prev, { address: "", tickets: 1 }]);
  };

  const removeParticipantRow = (index: number) => {
    setManualParticipants((prev) => prev.filter((_, i) => i !== index));
  };

  const updateParticipant = (index: number, field: "address" | "tickets", value: string | number) => {
    setManualParticipants((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="ui-container rounded h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="ui-container rounded p-8 text-center">
        <p className="text-muted-blue">Raffle not found</p>
      </div>
    );
  }

  const { raffle, entries, winners, prizes, chainStatus, chainEndTime } = data;
  const status = getRaffleStatus(raffle.start_date, raffle.end_date, undefined, chainStatus as any);

  // Scheduled raffles (on-chain endTime > 0) revert endRaffle until their time
  // passes. Lock the End / Manual End buttons until then so a click can't fail
  // with "Raffle not yet ended". endTime 0 = owner-managed, endable anytime.
  const endTimeMs = chainEndTime ? chainEndTime * 1000 : 0;
  const endLocked = endTimeMs > 0 && Date.now() < endTimeMs;
  const endUnlockLabel = endLocked ? format(new Date(endTimeMs), "MMM d, yyyy HH:mm") : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <button className="p-2 bg-black/5 hover:bg-black/10 text-[#0062df] rounded transition-all border border-black/10">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          </Link>
          <h2 className="text-5xl font-header text-text-primary">{raffle.title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {status === "pending" && (
            <button
              onClick={handleActivateRaffle}
              disabled={actionLoading.activate}
              className="px-6 py-3 bg-emerald-500 hover:brightness-110 text-text-primary font-bold rounded uppercase tracking-widest text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading.activate ? "Activating..." : "Activate Raffle"}
            </button>
          )}
          {status === "active" && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleEndRaffle}
                disabled={actionLoading.end || endLocked}
                title={endLocked ? `Scheduled raffle — contract locks end until ${endUnlockLabel}` : undefined}
                className="px-6 py-3 bg-orange-500 hover:brightness-110 text-text-primary font-bold rounded uppercase tracking-widest text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading.end ? "Ending..." : "End Raffle"}
              </button>
              {endLocked && (
                <span className="text-[10px] text-muted-blue uppercase tracking-widest">
                  Locked until {endUnlockLabel}
                </span>
              )}
            </div>
          )}
          {(status === "active" || status === "pending") && raffle.chain_raffle_id != null && (
            <button
              onClick={handleCancelRaffle}
              disabled={actionLoading.cancel}
              title="Cancel on-chain and return the escrowed prize to its creator or the platform owner. No winner is drawn. Not time-locked."
              className="px-6 py-3 bg-red-500 hover:brightness-110 text-text-primary font-bold rounded uppercase tracking-widest text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading.cancel ? "Cancelling..." : "Cancel Raffle"}
            </button>
          )}
        </div>
      </div>

      {/* Status and Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="ui-container p-6 rounded">
          <p className="text-muted-blue text-[10px] font-bold uppercase tracking-widest mb-2">Status</p>
          <span className={`inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded border ${
            status === "active"
              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              : status === "pending"
              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
              : "bg-black/5 text-muted-blue border-black/10"
          }`}>
            {status}
          </span>
        </div>
        <div className="ui-container p-6 rounded">
          <p className="text-muted-blue text-[10px] font-bold uppercase tracking-widest mb-2">Participants</p>
          <p className="text-3xl font-display font-bold text-text-primary">{entries.length}</p>
        </div>
        <div className="ui-container p-6 rounded">
          <p className="text-muted-blue text-[10px] font-bold uppercase tracking-widest mb-2">Prizes</p>
          <p className="text-3xl font-display font-bold text-text-primary">{prizes.length}</p>
        </div>
        <div className="ui-container p-6 rounded">
          <p className="text-muted-blue text-[10px] font-bold uppercase tracking-widest mb-2">Winners</p>
          <p className="text-3xl font-display font-bold text-text-primary">{winners.length}</p>
        </div>
      </div>

      {/* Description */}
      <div className="ui-container rounded p-6">
        <h3 className="text-xl font-header text-text-primary mb-4">Description</h3>
        <p className="text-text-primary/80">{raffle.description}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-blue">Start Date:</span>
            <span className="text-text-primary ml-2">{format(new Date(raffle.start_date), "MMM d, yyyy HH:mm")}</span>
          </div>
          <div>
            <span className="text-muted-blue">End Date:</span>
            <span className="text-text-primary ml-2">{format(new Date(raffle.end_date), "MMM d, yyyy HH:mm")}</span>
          </div>
          <div>
            <span className="text-muted-blue">Tokens Required:</span>
            <span className="text-text-primary ml-2">{raffle.tokens_required}</span>
          </div>
          <div>
            <span className="text-muted-blue">Max Entries Per User:</span>
            <span className="text-text-primary ml-2">{raffle.max_entries_per_user}</span>
          </div>
        </div>
      </div>

      {/* Prizes */}
      <div className="ui-container rounded overflow-hidden">
        <div className="px-6 py-4 border-b border-black/10">
          <h3 className="text-xl font-header text-text-primary">Prizes</h3>
        </div>
        {prizes.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead className="bg-black/5 border-b border-black/10">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-blue">Type</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-blue">Token Address</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-blue">Amount/ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {prizes.map((prize) => (
                <tr key={prize.id} className="hover:bg-black/5 transition-colors">
                  <td className="px-6 py-5">
                    <span className="text-sm text-text-primary uppercase">{prize.prize_type}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm text-text-primary font-mono">{prize.prize_token_address.slice(0, 10)}...{prize.prize_token_address.slice(-8)}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm text-text-primary">{prize.prize_amount || prize.prize_token_id || "N/A"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center">
            <p className="text-muted-blue">No prizes</p>
          </div>
        )}
      </div>

      {/* Winners */}
      {winners.length > 0 && (
        <div className="ui-container rounded overflow-hidden">
          <div className="px-6 py-4 border-b border-black/10">
            <h3 className="text-xl font-header text-text-primary">Winners</h3>
          </div>
          <table className="w-full text-left border-collapse">
            <thead className="bg-black/5 border-b border-black/10">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-blue">Wallet Address</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-blue">Won At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {winners.map((winner) => (
                <tr key={winner.id} className="hover:bg-black/5 transition-colors">
                  <td className="px-6 py-5">
                    <span className="text-sm text-text-primary font-mono">{winner.wallet_address}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm text-text-primary">{format(new Date(winner.created_at), "MMM d, yyyy HH:mm")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual End Raffle */}
      <div className="ui-container rounded overflow-hidden">
        <div className="px-6 py-4 border-b border-black/10 flex items-center justify-between">
          <h3 className="text-xl font-header text-text-primary">Manual End Raffle</h3>
          <button
            onClick={() => setShowManualEnd((prev) => !prev)}
            className="px-4 py-2 bg-black/5 hover:bg-black/10 text-text-primary text-sm font-bold rounded uppercase tracking-widest transition-all border border-black/10"
          >
            {showManualEnd ? "Hide" : "Configure"}
          </button>
        </div>
        {showManualEnd && (
          <div className="p-6 space-y-4">
            <p className="text-muted-blue text-sm">
              Manually end the raffle with custom participants and ticket counts. This bypasses the database entries and sends custom data directly to the smart contract.
            </p>

            {endLocked && (
              <p className="text-orange-500 text-sm">
                Scheduled raffle — the contract blocks ending until {endUnlockLabel}. To close it early, use the Cancel Raffle button (returns the prize, no winner).
              </p>
            )}

            {/* Participant rows */}
            <div className="space-y-3">
              {manualParticipants.map((participant, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-muted-blue text-sm w-6 shrink-0">{index + 1}.</span>
                  <input
                    type="text"
                    placeholder="0x... wallet address"
                    value={participant.address}
                    onChange={(e) => updateParticipant(index, "address", e.target.value)}
                    className="flex-1 px-4 py-3 bg-black/5 border border-black/10 rounded text-text-primary text-sm font-mono placeholder:text-text-primary/20 focus:outline-none focus:border-text-primary/30"
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="Tickets"
                    value={participant.tickets}
                    onChange={(e) => updateParticipant(index, "tickets", parseInt(e.target.value) || 0)}
                    className="w-28 px-4 py-3 bg-black/5 border border-black/10 rounded text-text-primary text-sm font-mono placeholder:text-text-primary/20 focus:outline-none focus:border-text-primary/30"
                  />
                  {manualParticipants.length > 1 && (
                    <button
                      onClick={() => removeParticipantRow(index)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all"
                    >
                      <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={addParticipantRow}
                className="flex items-center gap-2 px-4 py-2 bg-black/5 hover:bg-black/10 text-text-primary text-sm font-bold rounded uppercase tracking-widest transition-all border border-black/10"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Add Participant
              </button>

              <button
                onClick={handleManualEndRaffle}
                disabled={actionLoading.manualEnd || endLocked}
                title={endLocked ? `Scheduled raffle — contract locks end until ${endUnlockLabel}` : undefined}
                className="px-6 py-3 bg-orange-500 hover:brightness-110 text-text-primary font-bold rounded uppercase tracking-widest text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading.manualEnd ? "Ending..." : "Manually End Raffle"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Entries */}
      <div className="ui-container rounded overflow-hidden">
        <div className="px-6 py-4 border-b border-black/10">
          <h3 className="text-xl font-header text-text-primary">Entries ({entries.length})</h3>
        </div>
        {entries.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead className="bg-black/5 border-b border-black/10">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-blue">Wallet Address</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-blue">Tokens Spent</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-blue">Entry Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-black/5 transition-colors">
                  <td className="px-6 py-5">
                    <span className="text-sm text-text-primary font-mono">{entry.wallet_address}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm font-display font-bold text-text-primary">{entry.tokens_spent}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm text-text-primary">{format(new Date(entry.created_at), "MMM d, yyyy HH:mm")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-muted-blue text-4xl mb-2 block">person_off</span>
            <p className="text-muted-blue">No entries yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
