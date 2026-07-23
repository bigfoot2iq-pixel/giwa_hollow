"use client";

import { Fragment, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { contracts, RobinhoodRafflesABI } from "@/lib/contracts";
import { ERC20_DECIMALS_ABI, toTokenUnits } from "@/lib/utils/erc20";
import { DateTimePicker } from "@/components/ui/date-time-picker";

interface CreateRaffleModalProps {
  onClose: () => void;
  onCreated?: () => void;
}

type Status =
  | "idle"
  | "loading-token"
  | "approving"
  | "creating"
  | "registering"
  | "success"
  | "error";

type PrizeKind = "erc20" | "nft";

// PrizeType enum on the contract: ERC20 = 0, ERC721 = 1, ERC6220 = 2.
const PRIZE_TYPE_ERC721 = 1;

// Minimal ERC20 ABI for the allowance check + approval done in the browser.
const ERC20_ALLOWANCE_ABI = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// Minimal ERC721 ABI for the operator-approval check + escrow approval.
const ERC721_APPROVAL_ABI = [
  {
    name: "isApprovedForAll",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "setApprovalForAll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
] as const;

const isAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v);
const isDecimal = (v: string) => /^\d+(\.\d+)?$/.test(v) && Number(v) > 0;
const isUint = (v: string) => /^\d+$/.test(v);

// Wizard steps — fields grouped by what the creator is thinking about.
const STEPS = [
  { id: "info", label: "Details", icon: "edit_note", hint: "Name your raffle" },
  { id: "entries", label: "Entries", icon: "confirmation_number", hint: "Set the entry rules" },
  { id: "prize", label: "Prize & Close", icon: "trophy", hint: "Fund the prize" },
] as const;
const LAST_STEP = STEPS.length - 1;

export function CreateRaffleModal({ onClose, onCreated }: CreateRaffleModalProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tokensRequired, setTokensRequired] = useState("10");
  const [maxEntriesPerUser, setMaxEntriesPerUser] = useState("10");
  const [maxParticipants, setMaxParticipants] = useState("100");
  const [prizeKind, setPrizeKind] = useState<PrizeKind>("erc20");
  const [prizeToken, setPrizeToken] = useState("");
  const [prizeAmounts, setPrizeAmounts] = useState<string[]>([""]);
  const [tokenIds, setTokenIds] = useState<string[]>([""]);
  const [endDate, setEndDate] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const busy =
    status === "loading-token" ||
    status === "approving" ||
    status === "creating" ||
    status === "registering";

  // The active prize-slot list depends on the selected prize kind.
  const slots = prizeKind === "erc20" ? prizeAmounts : tokenIds;
  const setSlots = prizeKind === "erc20" ? setPrizeAmounts : setTokenIds;
  const setSlot = (i: number, v: string) =>
    setSlots((prev) => prev.map((a, idx) => (idx === i ? v : a)));
  const addSlot = () => setSlots((prev) => [...prev, ""]);
  const removeSlot = (i: number) =>
    setSlots((prev) => prev.filter((_, idx) => idx !== i));

  // Validate only the fields that live on a given step, so the creator gets
  // feedback as they move through the wizard rather than all at once.
  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!title.trim()) return "Title is required";
      if (!description.trim()) return "Description is required";
      if (imageUrl && !/^https?:\/\//.test(imageUrl)) return "Image URL must be a valid URL";
    }

    if (s === 1) {
      if (!(Number(tokensRequired) > 0)) return "Entry cost must be positive";
      if (!(Number(maxEntriesPerUser) > 0)) return "Max entries per user must be positive";
      if (!(Number(maxParticipants) > 0)) return "Max participants must be positive";
    }

    if (s === 2) {
      if (!isAddress(prizeToken))
        return prizeKind === "erc20" ? "Invalid prize token address" : "Invalid NFT collection address";

      if (prizeKind === "erc20") {
        const amounts = prizeAmounts.map((a) => a.trim()).filter(Boolean);
        if (amounts.length === 0) return "At least one prize amount is required";
        if (!amounts.every(isDecimal)) return "Prize amounts must be positive numbers";
      } else {
        const ids = tokenIds.map((t) => t.trim()).filter(Boolean);
        if (ids.length === 0) return "At least one token ID is required";
        if (!ids.every(isUint)) return "Token IDs must be whole numbers";
        if (new Set(ids).size !== ids.length) return "Token IDs must be unique";
      }

      if (!endDate) return "End date is required";
      if (new Date(endDate).getTime() <= Date.now()) return "End date must be in the future";
    }

    return null;
  }

  function goNext() {
    const stepError = validateStep(step);
    if (stepError) {
      setError(stepError);
      return;
    }
    setError(null);
    if (status === "error") setStatus("idle");
    setStep((s) => Math.min(s + 1, LAST_STEP));
  }

  function goBack() {
    setError(null);
    if (status === "error") setStatus("idle");
    setStep((s) => Math.max(s - 1, 0));
  }

  // Jump back to an already-completed step via the stepper (forward is gated by Continue).
  function goToStep(target: number) {
    if (target >= step) return;
    setError(null);
    if (status === "error") setStatus("idle");
    setStep(target);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // On non-final steps (incl. the Enter key), advance instead of submitting.
    if (step < LAST_STEP) {
      goNext();
      return;
    }

    if (!isConnected || !address || !publicClient) {
      setError("Connect your wallet first");
      setStatus("error");
      return;
    }

    // Re-check every step; jump to the first one that fails.
    for (let s = 0; s <= LAST_STEP; s++) {
      const stepError = validateStep(s);
      if (stepError) {
        setError(stepError);
        setStatus("error");
        setStep(s);
        return;
      }
    }

    setError(null);
    try {
      const token = prizeToken as `0x${string}`;
      const endTimeUnix = BigInt(Math.floor(new Date(endDate).getTime() / 1000));

      let createHash: `0x${string}`;
      let prizes: {
        prize_type: "erc20" | "erc721";
        prize_token_address: string;
        prize_amount: string | null;
        prize_token_id: string | null;
      }[];

      if (prizeKind === "erc20") {
        // Resolve prize token decimals to convert human amounts to base units.
        setStatus("loading-token");
        const decimals = (await publicClient.readContract({
          address: token,
          abi: ERC20_DECIMALS_ABI,
          functionName: "decimals",
        })) as number;

        const humanAmounts = prizeAmounts.map((a) => a.trim()).filter(Boolean);
        const amountsWei = humanAmounts.map((a) => BigInt(toTokenUnits(a, Number(decimals))));
        const totalWei = amountsWei.reduce((sum, a) => sum + a, 0n);

        // Approve the raffle contract to pull the escrowed prize, if needed.
        const allowance = (await publicClient.readContract({
          address: token,
          abi: ERC20_ALLOWANCE_ABI,
          functionName: "allowance",
          args: [address, contracts.raffles.address],
        })) as bigint;

        if (allowance < totalWei) {
          setStatus("approving");
          const approveHash = await writeContractAsync({
            address: token,
            abi: ERC20_ALLOWANCE_ABI,
            functionName: "approve",
            args: [contracts.raffles.address, totalWei],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }

        // Create the raffle on-chain (escrows the prize, goes ACTIVE immediately).
        setStatus("creating");
        createHash = await writeContractAsync({
          address: contracts.raffles.address,
          abi: RobinhoodRafflesABI,
          functionName: "createRaffleByUser",
          args: [token, amountsWei, endTimeUnix],
        });

        prizes = humanAmounts.map((_, i) => ({
          prize_type: "erc20",
          prize_token_address: token,
          prize_amount: amountsWei[i].toString(),
          prize_token_id: null,
        }));
      } else {
        const ids = tokenIds.map((t) => t.trim()).filter(Boolean);
        const idsBig = ids.map((id) => BigInt(id));

        // Approve the raffle contract to escrow the NFTs (operator approval), if needed.
        const approvedForAll = (await publicClient.readContract({
          address: token,
          abi: ERC721_APPROVAL_ABI,
          functionName: "isApprovedForAll",
          args: [address, contracts.raffles.address],
        })) as boolean;

        if (!approvedForAll) {
          setStatus("approving");
          const approveHash = await writeContractAsync({
            address: token,
            abi: ERC721_APPROVAL_ABI,
            functionName: "setApprovalForAll",
            args: [contracts.raffles.address, true],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }

        // Create the NFT raffle on-chain (escrows the tokens, goes ACTIVE immediately).
        setStatus("creating");
        createHash = await writeContractAsync({
          address: contracts.raffles.address,
          abi: RobinhoodRafflesABI,
          functionName: "createRaffleByUserWithNFT",
          args: [PRIZE_TYPE_ERC721, token, idsBig, endTimeUnix],
        });

        prizes = ids.map((id) => ({
          prize_type: "erc721",
          prize_token_address: token,
          prize_amount: null,
          prize_token_id: id,
        }));
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
      if (receipt.status !== "success") {
        throw new Error("Raffle creation transaction failed");
      }

      // Register metadata so the raffle shows up in the explorer list.
      setStatus("registering");
      const response = await fetch("/api/raffles/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: createHash,
          creatorWallet: address,
          raffleData: {
            title: title.trim(),
            description: description.trim(),
            image_url: imageUrl.trim() || null,
            tokens_required: Number(tokensRequired),
            max_entries_per_user: Number(maxEntriesPerUser),
            max_participants: Number(maxParticipants),
            start_date: new Date().toISOString(),
            end_date: new Date(endDate).toISOString(),
            prizes,
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          (payload?.error || "Failed to register raffle") +
            ". Your prize is escrowed on-chain — contact support with your tx hash."
        );
      }

      setStatus("success");
      onCreated?.();
    } catch (err: unknown) {
      setStatus("error");
      setError(
        (err as { shortMessage?: string })?.shortMessage ||
          (err as Error)?.message ||
          "Something went wrong"
      );
    }
  }

  const inputClass =
    "w-full bg-dark-navy border border-white/10 rounded px-4 py-3 text-text-primary placeholder-muted-blue focus:outline-none focus:ring-1 focus:ring-[#2ee6a6]";
  const labelClass =
    "text-[10px] font-bold uppercase text-muted-blue tracking-widest block mb-2";

  const isNft = prizeKind === "nft";

  const submitLabel =
    status === "loading-token"
      ? "Reading token..."
      : status === "approving"
        ? "Approving prize..."
        : status === "creating"
          ? "Creating raffle..."
          : status === "registering"
            ? "Finishing up..."
            : "Create Raffle";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="ui-container my-8 w-full max-w-2xl rounded">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
          <div>
            <h3 className="text-lg font-header text-text-primary">Create Your Raffle</h3>
            {status !== "success" && (
              <p className="mt-0.5 text-xs text-muted-blue">
                Step {step + 1} of {STEPS.length} · {STEPS[step].hint}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded p-1 text-muted-blue transition-colors hover:text-text-primary disabled:opacity-50"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {status !== "success" && (
          <div className="flex items-start border-b border-white/10 px-6 py-5">
            {STEPS.map((st, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <Fragment key={st.id}>
                  <button
                    type="button"
                    onClick={() => goToStep(i)}
                    disabled={i >= step || busy}
                    className={`flex flex-col items-center gap-1.5 ${
                      done ? "cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold transition-all ${
                        done
                          ? "border-transparent bg-[#0c1512] text-[#2ee6a6]"
                          : active
                            ? "border-[#2ee6a6] bg-[#2ee6a6]/10 text-[#2ee6a6] ring-4 ring-[#2ee6a6]/10"
                            : "border-white/10 bg-white/5 text-muted-blue"
                      }`}
                    >
                      {done ? (
                        <span className="material-symbols-outlined text-[18px]">check</span>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${
                        active ? "text-text-primary" : done ? "text-muted-blue" : "text-muted-blue/50"
                      }`}
                    >
                      {st.label}
                    </span>
                  </button>
                  {i < LAST_STEP && (
                    <div
                      className={`mt-[18px] h-px flex-1 transition-colors ${
                        i < step ? "bg-[#2ee6a6]" : "bg-white/10"
                      }`}
                    />
                  )}
                </Fragment>
              );
            })}
          </div>
        )}

        {status === "success" ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="material-symbols-outlined mb-4 text-5xl text-emerald-500">
              check_circle
            </span>
            <p className="mb-2 font-header text-xl text-text-primary">Raffle Created!</p>
            <p className="mb-6 text-sm text-muted-blue">
              It will auto-close at your chosen time.
            </p>
            <button
              onClick={onClose}
              className="rounded bg-[#0c1512] border border-white/10 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-text-primary transition-all hover:brightness-125"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6">
            {/* Step content re-animates on each transition via the keyed wrapper. */}
            <div key={step} className="animate-step space-y-4">
              {step === 0 && (
                <>
                  <div>
                    <label className={labelClass}>Title</label>
                    <input
                      className={inputClass}
                      placeholder="e.g. Genesis Sword Giveaway"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Description</label>
                    <textarea
                      className={`${inputClass} resize-none`}
                      rows={4}
                      placeholder="What is this raffle about? Who is it for?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Image URL (optional)</label>
                    <input
                      className={inputClass}
                      placeholder="https://..."
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                    />
                    {imageUrl && /^https?:\/\//.test(imageUrl) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt="Raffle preview"
                        className="mt-3 h-32 w-full rounded border border-white/10 object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <p className="text-sm text-muted-blue">
                    Set how players spend GIWA to enter and how big the pool can get.
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className={labelClass}>Entry Cost (GIWA)</label>
                      <input
                        type="number"
                        className={inputClass}
                        value={tokensRequired}
                        onChange={(e) => setTokensRequired(e.target.value)}
                      />
                      <p className="mt-1.5 text-[11px] text-muted-blue/70">GIWA per entry.</p>
                    </div>
                    <div>
                      <label className={labelClass}>Max Entries / User</label>
                      <input
                        type="number"
                        className={inputClass}
                        value={maxEntriesPerUser}
                        onChange={(e) => setMaxEntriesPerUser(e.target.value)}
                      />
                      <p className="mt-1.5 text-[11px] text-muted-blue/70">Entries per wallet.</p>
                    </div>
                    <div>
                      <label className={labelClass}>Max Participants</label>
                      <input
                        type="number"
                        className={inputClass}
                        value={maxParticipants}
                        onChange={(e) => setMaxParticipants(e.target.value)}
                      />
                      <p className="mt-1.5 text-[11px] text-muted-blue/70">Total entrants.</p>
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <label className={labelClass}>Prize Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["erc20", "nft"] as PrizeKind[]).map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => setPrizeKind(kind)}
                          className={`rounded border px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all ${
                            prizeKind === kind
                              ? "border-[#2ee6a6] bg-[#2ee6a6]/10 text-text-primary"
                              : "border-white/10 bg-white/5 text-muted-blue hover:text-text-primary"
                          }`}
                        >
                          {kind === "erc20" ? "ERC20 Token" : "NFT (ERC721)"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>
                      {isNft ? "NFT Collection Address (ERC721)" : "Prize Token Address (ERC20)"}
                    </label>
                    <input
                      className={`${inputClass} font-mono`}
                      placeholder="0x..."
                      value={prizeToken}
                      onChange={(e) => setPrizeToken(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className={labelClass}>
                      {isNft ? "Token IDs (one per winner)" : "Prize Amounts (one per winner)"}
                    </label>
                    {slots.map((value, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          className={`${inputClass} flex-1`}
                          placeholder={isNft ? "42" : "100"}
                          value={value}
                          onChange={(e) => setSlot(i, e.target.value)}
                        />
                        {slots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSlot(i)}
                            className="rounded bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-blue hover:bg-white/10"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addSlot}
                      className="rounded bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-blue hover:bg-white/10"
                    >
                      {isNft ? "Add Token ID" : "Add Prize"}
                    </button>
                  </div>

                  <div>
                    <label className={labelClass}>Auto-Close Date</label>
                    <DateTimePicker value={endDate} onChange={setEndDate} />
                  </div>

                  <div className="rounded border border-white/10 bg-white/5 p-3 text-xs text-muted-blue">
                    You escrow the prize now
                    {isNft ? " (you'll approve the raffle contract to hold your NFTs)" : ""}. Entrants
                    pay GIWA (sent to you). The raffle ends automatically after the close date, when
                    the owner&apos;s settler draws winners.
                  </div>
                </>
              )}
            </div>

            {error && (
              <div className="mt-4 rounded border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={goBack}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-widest text-muted-blue transition-all hover:text-text-primary disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  Back
                </button>
              )}

              {step < LAST_STEP ? (
                <button
                  type="submit"
                  className="ml-auto flex items-center gap-1.5 rounded bg-[#0c1512] border border-white/10 px-6 py-3 text-xs font-bold uppercase tracking-widest text-text-primary transition-all hover:brightness-125"
                >
                  Continue
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={busy}
                  className="ml-auto flex items-center justify-center gap-2 rounded bg-[#0c1512] border border-white/10 px-6 py-3 text-xs font-bold uppercase tracking-[0.15em] text-text-primary shadow-[0_0_20px_rgba(12,21,18,0.15)] transition-all hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy && (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {submitLabel}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
