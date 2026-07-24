"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useSignMessage, useReadContract, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { privateKeyToAccount } from "viem/accounts";
import { ERC20_DECIMALS_ABI, toTokenUnits } from "@/lib/utils/erc20";
import { RobinhoodRafflesABI, contracts } from "@/lib/contracts";
import { DateTimePicker } from "@/components/ui/date-time-picker";

const normalizePrizeValues = (values: Array<{ value: string }>) =>
  values.map((item) => item.value.trim()).filter((value) => value.length > 0);

const isUintString = (value: string) => /^\d+$/.test(value);

// Validate decimal number (allows decimals for token amounts)
const isDecimalString = (value: string) => /^\d+(\.\d+)?$/.test(value);

const createRaffleSchema = z
  .object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().min(1, "Description is required"),
  image_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  tokens_required: z.number().positive("Must be positive"),
  max_entries_per_user: z.number().positive("Must be positive"),
  max_participants: z.number().positive("Must be positive"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  prize_type: z.enum(["erc20", "erc721", "erc6220"]),
  prize_token_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address"),
  prize_amounts: z.array(z.object({ value: z.string() })),
  prize_token_ids: z.array(z.object({ value: z.string() })),
})
  .superRefine((data, ctx) => {
    if (data.prize_type === "erc20") {
      const amounts = data.prize_amounts ?? [];
      if (amounts.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["prize_amounts"],
          message: "At least one prize amount is required",
        });
      }
      amounts.forEach((item, index) => {
        const trimmed = item.value.trim();
        if (!trimmed) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["prize_amounts", index, "value"],
            message: "Prize amount required",
          });
        } else if (!isDecimalString(trimmed)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["prize_amounts", index, "value"],
            message: "Prize amounts must be valid numbers",
          });
        }
      });
      if ((data.prize_token_ids ?? []).length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["prize_token_ids"],
          message: "Token IDs are only valid for NFT prizes",
        });
      }
    } else {
      const tokenIds = data.prize_token_ids ?? [];
      if (tokenIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["prize_token_ids"],
          message: "At least one token ID is required",
        });
      }
      tokenIds.forEach((item, index) => {
        const trimmed = item.value.trim();
        if (!trimmed) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["prize_token_ids", index, "value"],
            message: "Token ID required",
          });
        } else if (!isUintString(trimmed)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["prize_token_ids", index, "value"],
            message: "Token IDs must be whole numbers",
          });
        }
      });
      if ((data.prize_amounts ?? []).length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["prize_amounts"],
          message: "Prize amounts are only valid for ERC20 prizes",
        });
      }
    }
  });

type FormData = z.infer<typeof createRaffleSchema>;

type VerificationStatus = "idle" | "verifying" | "success" | "error";

export default function CreateRafflePage() {
  const router = useRouter();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [step, setStep] = useState<"form" | "complete">("form");
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("idle");
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationDetails, setVerificationDetails] = useState<any>(null);
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState<string | null>(null);
  const [fetchingTokenInfo, setFetchingTokenInfo] = useState(false);
  const [pendingRaffleData, setPendingRaffleData] = useState<any>(null);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
  const [pendingConfirmData, setPendingConfirmData] = useState<any>(null);

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createRaffleSchema),
    defaultValues: {
      tokens_required: 10,
      max_entries_per_user: 100,
      max_participants: 100,
      prize_type: "erc20",
      prize_amounts: [{ value: "" }],
      prize_token_ids: [],
    },
  });

  const prizeType = watch("prize_type");
  const prizeTokenAddress = watch("prize_token_address");
  const prizeAmountsWatch = watch("prize_amounts");
  const prizeTokenIdsWatch = watch("prize_token_ids");
  
  const {
    fields: prizeAmountFields,
    append: appendPrizeAmount,
    remove: removePrizeAmount,
    replace: replacePrizeAmounts,
  } = useFieldArray({ control, name: "prize_amounts" });
  const {
    fields: prizeTokenIdFields,
    append: appendPrizeTokenId,
    remove: removePrizeTokenId,
    replace: replacePrizeTokenIds,
  } = useFieldArray({ control, name: "prize_token_ids" });

  useEffect(() => {
    if (prizeType === "erc20") {
      if (prizeAmountFields.length === 0) {
        appendPrizeAmount({ value: "" });
      }
      if (prizeTokenIdFields.length > 0) {
        replacePrizeTokenIds([]);
      }
    } else {
      if (prizeTokenIdFields.length === 0) {
        appendPrizeTokenId({ value: "" });
      }
      if (prizeAmountFields.length > 0) {
        replacePrizeAmounts([]);
      }
    }
    // Reset verification when prize type changes
    setVerificationStatus("idle");
    setVerificationError(null);
    setVerificationDetails(null);
  }, [
    appendPrizeAmount,
    appendPrizeTokenId,
    prizeAmountFields.length,
    prizeTokenIdFields.length,
    prizeType,
    replacePrizeAmounts,
    replacePrizeTokenIds,
  ]);

  // Reset verification when prize token address or amounts/ids change
  useEffect(() => {
    setVerificationStatus("idle");
    setVerificationError(null);
    setVerificationDetails(null);
  }, [prizeTokenAddress, prizeAmountFields, prizeTokenIdFields]);

  // Fetch token decimals when prize token address changes (for ERC20 only)
  useEffect(() => {
    const fetchTokenInfo = async () => {
      if (!prizeTokenAddress || prizeType !== "erc20" || !/^0x[a-fA-F0-9]{40}$/.test(prizeTokenAddress)) {
        setTokenDecimals(null);
        setTokenSymbol(null);
        return;
      }

      if (!publicClient) {
        return;
      }

      setFetchingTokenInfo(true);
      try {
        // Fetch decimals
        const decimals = await publicClient.readContract({
          address: prizeTokenAddress as `0x${string}`,
          abi: ERC20_DECIMALS_ABI,
          functionName: "decimals",
        });

        // Fetch symbol
        const symbol = await publicClient.readContract({
          address: prizeTokenAddress as `0x${string}`,
          abi: ERC20_DECIMALS_ABI,
          functionName: "symbol",
        });

        setTokenDecimals(Number(decimals));
        setTokenSymbol(symbol as string);
      } catch (err) {
        console.error("Failed to fetch token info:", err);
        setTokenDecimals(null);
        setTokenSymbol(null);
      } finally {
        setFetchingTokenInfo(false);
      }
    };

    fetchTokenInfo();
  }, [prizeTokenAddress, prizeType, publicClient]);

  const handleVerifyPrize = async () => {
    if (!address) {
      setVerificationError("Wallet not connected");
      return;
    }

    setVerificationStatus("verifying");
    setVerificationError(null);
    setVerificationDetails(null);

    try {
      console.log("[Verify] Starting verification...", {
        prizeType,
        prizeTokenAddress,
        address,
      });

      const timestamp = Date.now().toString();
      const message = `GIWA Raffles Admin\nTimestamp: ${timestamp}`;
      
      console.log("[Verify] Requesting signature...");
      const signature = await signMessageAsync({ message });
      console.log("[Verify] Signature received");

      // Convert human-readable amounts to wei for ERC20 tokens
      let prizeAmounts: string[] = [];
      if (prizeType === "erc20") {
        if (!tokenDecimals) {
          throw new Error("Token decimals not loaded. Please wait or refresh the page.");
        }
        const humanAmounts = (prizeAmountsWatch || [])
          .map((field) => field.value?.trim())
          .filter((v): v is string => Boolean(v));
        prizeAmounts = humanAmounts.map((amount) => toTokenUnits(amount, tokenDecimals));
        console.log("[Verify] Converted amounts:", { humanAmounts, prizeAmounts });
      }

      const prizeTokenIds = prizeType === "erc20" 
        ? []
        : (prizeTokenIdsWatch || [])
            .map((field) => field.value?.trim())
            .filter((v): v is string => Boolean(v));

      console.log("[Verify] Sending verification request...");
      const response = await fetch("/api/admin/verify-prize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-wallet": address,
          "x-admin-signature": signature,
          "x-admin-timestamp": timestamp,
        },
        body: JSON.stringify({
          prize_type: prizeType,
          prize_token_address: prizeTokenAddress,
          prize_amounts: prizeAmounts,
          prize_token_ids: prizeTokenIds,
        }),
      });

      console.log("[Verify] Response status:", response.status);
      const data = await response.json();
      console.log("[Verify] Response data:", data);

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      if (data.isValid) {
        setVerificationStatus("success");
        setVerificationDetails(data.details);
        console.log("[Verify] Success! Admin wallet verified:", data.details.ownerAddress);
      } else {
        setVerificationStatus("error");
        setVerificationError(data.error || "Verification failed");
        setVerificationDetails(data.details);
      }
    } catch (err) {
      console.error("[Verify] Error:", err);
      setVerificationStatus("error");
      setVerificationError(err instanceof Error ? err.message : "Verification failed");
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!address) return;
    setError(null);

    try {
      const timestamp = Date.now().toString();
      const message = `GIWA Raffles Admin\nTimestamp: ${timestamp}`;
      const signature = await signMessageAsync({ message });

      // Convert human-readable amounts to wei for ERC20 tokens
      let prizeAmounts: string[] = [];
      if (data.prize_type === "erc20") {
        if (!tokenDecimals) {
          throw new Error("Token decimals not loaded. Please wait or refresh the page.");
        }
        prizeAmounts = normalizePrizeValues(data.prize_amounts).map((amount) =>
          toTokenUnits(amount, tokenDecimals)
        );
      }

      const prizeTokenIds = data.prize_type === "erc20" ? [] : normalizePrizeValues(data.prize_token_ids);

      const prizes =
        data.prize_type === "erc20"
          ? prizeAmounts.map((amount) => ({
              prize_type: "erc20",
              prize_token_address: data.prize_token_address,
              prize_amount: amount,
              prize_token_id: null,
            }))
          : prizeTokenIds.map((tokenId) => ({
              prize_type: data.prize_type,
              prize_token_address: data.prize_token_address,
              prize_amount: null,
              prize_token_id: tokenId,
            }));
      
      const raffleData = {
        title: data.title,
        description: data.description,
        image_url: data.image_url || null,
        tokens_required: data.tokens_required,
        max_entries_per_user: data.max_entries_per_user,
        max_participants: data.max_participants,
        start_date: new Date(data.start_date).toISOString(),
        end_date: new Date(data.end_date).toISOString(),
        prizes,
      };

      // Step 1: Get transaction data from API
      const response = await fetch("/api/admin/raffles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-wallet": address,
          "x-admin-signature": signature,
          "x-admin-timestamp": timestamp,
        },
        body: JSON.stringify(raffleData),
      });

      const payload = await response.json();
      if (!response.ok) {
        // Check if it's an approval error
        if (payload.error === "Insufficient allowance") {
          // Handle ERC20 approval
          setError("Approving token spending...");
          
          const erc20Abi = [
            {
              name: "approve",
              type: "function",
              stateMutability: "nonpayable",
              inputs: [
                { name: "spender", type: "address" },
                { name: "amount", type: "uint256" }
              ],
              outputs: [{ name: "", type: "bool" }]
            }
          ] as const;
          
          const approvalAmount = payload.details?.requiredApproval || "115792089237316195423570985008687907853269984665640564039457584007913129639935"; // max uint256
          
          const approveTxHash = await writeContractAsync({
            address: data.prize_token_address as `0x${string}`,
            abi: erc20Abi,
            functionName: "approve",
            args: [contracts.raffles.address as `0x${string}`, BigInt(approvalAmount)],
          });
          
          console.log("Approval transaction sent:", approveTxHash);
          setError("Waiting for approval confirmation...");
          
          // Wait for approval transaction
          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
          }
          
          setError("Approval confirmed. Creating raffle...");
          
          // Retry the raffle creation
          return onSubmit(data);
        } else if (payload.error === "NFT not approved") {
          // Handle NFT approval
          setError("Approving NFT transfer...");
          
          const erc721Abi = [
            {
              name: "setApprovalForAll",
              type: "function",
              stateMutability: "nonpayable",
              inputs: [
                { name: "operator", type: "address" },
                { name: "approved", type: "bool" }
              ],
              outputs: []
            }
          ] as const;
          
          const approveTxHash = await writeContractAsync({
            address: data.prize_token_address as `0x${string}`,
            abi: erc721Abi,
            functionName: "setApprovalForAll",
            args: [contracts.raffles.address as `0x${string}`, true],
          });
          
          console.log("NFT approval transaction sent:", approveTxHash);
          setError("Waiting for approval confirmation...");
          
          // Wait for approval transaction
          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
          }
          
          setError("Approval confirmed. Creating raffle...");
          
          // Retry the raffle creation
          return onSubmit(data);
        }
        throw new Error(payload?.error || "Failed to create raffle");
      }

      // Step 2: Admin signs and sends the transaction (skip if we already have a pending tx)
      let txHash = pendingTxHash;
      let confirmData = pendingConfirmData || raffleData;

      if (txHash) {
        // We already sent an on-chain tx but confirm failed — retry confirm only
        console.log("Retrying confirm with existing txHash:", txHash);
      } else if (payload.requiresTransaction) {
        const { transaction } = payload;
        console.log("Sending transaction:", transaction);

        // Convert string args back to BigInt for the contract call
        const convertedArgs = transaction.prizeType === "erc20"
          ? [transaction.args[0], (transaction.args[1] as string[]).map((a: string) => BigInt(a))]
          : [transaction.args[0], transaction.args[1], (transaction.args[2] as string[]).map((id: string) => BigInt(id))];

        txHash = await writeContractAsync({
          address: contracts.raffles.address as `0x${string}`,
          abi: RobinhoodRafflesABI,
          functionName: transaction.functionName,
          args: convertedArgs as any,
        });

        console.log("Transaction sent:", txHash);

        // Save txHash so retries skip the on-chain tx
        setPendingTxHash(txHash);
        setPendingConfirmData(raffleData);
        confirmData = raffleData;
      } else {
        // Old flow (shouldn't happen with new code)
        setStep("complete");
        setTimeout(() => router.push("/admin"), 2000);
        return;
      }

      // Step 3: Confirm with backend
      const confirmResponse = await fetch("/api/admin/raffles/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-wallet": address,
          "x-admin-signature": signature,
          "x-admin-timestamp": timestamp,
        },
        body: JSON.stringify({
          txHash,
          raffleData: confirmData,
        }),
      });

      const confirmPayload = await confirmResponse.json();
      if (!confirmResponse.ok) {
        throw new Error(confirmPayload?.error || "Failed to confirm raffle");
      }

      // Success — clear pending state
      setPendingTxHash(null);
      setPendingConfirmData(null);
      setStep("complete");
      setTimeout(() => router.push("/admin"), 2000);
    } catch (err) {
      console.error("Error creating raffle:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to create raffle";
      if (pendingTxHash) {
        setError(`${errorMessage}. Your on-chain transaction was already sent. Click "Create Raffle" again to retry saving to the database without sending a new transaction.`);
      } else {
        setError(errorMessage);
      }
    }
  };

  const prizeAmountFieldErrors = errors.prize_amounts as
    | Record<number, { value?: { message?: string } }>
    | undefined;
  const prizeTokenIdFieldErrors = errors.prize_token_ids as
    | Record<number, { value?: { message?: string } }>
    | undefined;
  const prizeAmountRootError = (errors.prize_amounts as { message?: string } | undefined)?.message;
  const prizeTokenIdRootError = (errors.prize_token_ids as { message?: string } | undefined)?.message;

  if (step === "complete") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-emerald-500 text-4xl">check_circle</span>
        </div>
        <h1 className="text-2xl font-header text-text-primary mb-2">Raffle Created!</h1>
        <p className="text-muted-blue">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 bg-black/5 hover:bg-black/10 rounded transition-all"
        >
          <span className="material-symbols-outlined text-[#0062df]">arrow_back</span>
        </button>
        <h2 className="text-5xl font-header text-text-primary">Create New Raffle</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="ui-container rounded overflow-hidden">
          <div className="px-6 py-4 border-b border-black/10 bg-black/5">
            <h3 className="text-lg font-header text-text-primary">Basic Information</h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-blue tracking-widest block mb-2">Title</label>
              <input
                {...register("title")}
                className="w-full bg-dark-navy border border-black/10 rounded px-4 py-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-[#0062df]"
              />
              {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-muted-blue tracking-widest block mb-2">Description</label>
              <textarea
                {...register("description")}
                rows={4}
                className="w-full bg-dark-navy border border-black/10 rounded px-4 py-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-[#0062df] resize-none"
              />
              {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description.message}</p>}
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-muted-blue tracking-widest block mb-2">Image URL (optional)</label>
              <input
                {...register("image_url")}
                placeholder="https://..."
                className="w-full bg-dark-navy border border-black/10 rounded px-4 py-3 text-text-primary placeholder-muted-blue focus:outline-none focus:ring-1 focus:ring-[#0062df]"
              />
              {errors.image_url && <p className="text-red-400 text-xs mt-1">{errors.image_url.message}</p>}
            </div>
          </div>
        </div>

        {/* Entry Settings */}
        <div className="ui-container rounded overflow-hidden">
          <div className="px-6 py-4 border-b border-black/10 bg-black/5">
            <h3 className="text-lg font-header text-text-primary">Entry Settings</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-blue tracking-widest block mb-2">Tokens Per Entry</label>
              <input
                type="number"
                {...register("tokens_required", { valueAsNumber: true })}
                className="w-full bg-dark-navy border border-black/10 rounded px-4 py-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-[#0062df]"
              />
              {errors.tokens_required && <p className="text-red-400 text-xs mt-1">{errors.tokens_required.message}</p>}
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-muted-blue tracking-widest block mb-2">Max Entries Per User</label>
              <input
                type="number"
                {...register("max_entries_per_user", { valueAsNumber: true })}
                className="w-full bg-dark-navy border border-black/10 rounded px-4 py-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-[#0062df]"
              />
              {errors.max_entries_per_user && <p className="text-red-400 text-xs mt-1">{errors.max_entries_per_user.message}</p>}
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-muted-blue tracking-widest block mb-2">Max Participants</label>
              <input
                type="number"
                {...register("max_participants", { valueAsNumber: true })}
                className="w-full bg-dark-navy border border-black/10 rounded px-4 py-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-[#0062df]"
              />
              {errors.max_participants && <p className="text-red-400 text-xs mt-1">{errors.max_participants.message}</p>}
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="ui-container rounded overflow-hidden">
          <div className="px-6 py-4 border-b border-black/10 bg-black/5">
            <h3 className="text-lg font-header text-text-primary">Schedule</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-blue tracking-widest block mb-2">Start Date</label>
              <Controller
                control={control}
                name="start_date"
                render={({ field }) => (
                  <DateTimePicker
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Select start date & time"
                  />
                )}
              />
              {errors.start_date && <p className="text-red-400 text-xs mt-1">{errors.start_date.message}</p>}
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-muted-blue tracking-widest block mb-2">End Date</label>
              <Controller
                control={control}
                name="end_date"
                render={({ field }) => (
                  <DateTimePicker
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Select end date & time"
                  />
                )}
              />
              {errors.end_date && <p className="text-red-400 text-xs mt-1">{errors.end_date.message}</p>}
            </div>
          </div>
        </div>

        {/* Prize */}
        <div className="ui-container rounded overflow-hidden">
          <div className="px-6 py-4 border-b border-black/10 bg-black/5">
            <h3 className="text-lg font-header text-text-primary">Prize</h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-blue tracking-widest block mb-2">Prize Type</label>
              <select
                {...register("prize_type")}
                className="w-full bg-dark-navy border border-black/10 rounded px-4 py-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-[#0062df]"
              >
                <option value="erc20">ERC20 Token</option>
                <option value="erc721">NFT (ERC721)</option>
                <option value="erc6220">NFT (ERC6220)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-muted-blue tracking-widest block mb-2">Prize Token Address</label>
              <input
                {...register("prize_token_address")}
                placeholder="0x..."
                className="w-full bg-dark-navy border border-black/10 rounded px-4 py-3 text-text-primary font-mono placeholder-muted-blue focus:outline-none focus:ring-1 focus:ring-[#0062df]"
              />
              {errors.prize_token_address && <p className="text-red-400 text-xs mt-1">{errors.prize_token_address.message}</p>}
            </div>

            {prizeType === "erc20" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase text-muted-blue tracking-widest block">
                    Prize Amounts {tokenSymbol && `(${tokenSymbol})`}
                  </label>
                  {fetchingTokenInfo && (
                    <span className="text-xs text-muted-blue flex items-center gap-1">
                      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading token info...
                    </span>
                  )}
                  {tokenDecimals !== null && (
                    <span className="text-xs text-emerald-400">
                      {tokenDecimals} decimals
                    </span>
                  )}
                </div>
                {prizeAmountFields.map((field, index) => (
                  <div key={field.id}>
                    <div className="flex gap-2">
                      <input
                        {...register(`prize_amounts.${index}.value`)}
                        placeholder={tokenSymbol ? `100 ${tokenSymbol}` : "100"}
                        className="flex-1 bg-dark-navy border border-black/10 rounded px-4 py-3 text-text-primary placeholder-muted-blue focus:outline-none focus:ring-1 focus:ring-[#0062df]"
                      />
                      {prizeAmountFields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePrizeAmount(index)}
                          className="px-3 py-2 bg-black/5 hover:bg-black/10 text-muted-blue text-[10px] font-bold uppercase tracking-widest rounded"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {prizeAmountFieldErrors?.[index]?.value?.message && (
                      <p className="text-red-400 text-xs mt-1">{prizeAmountFieldErrors[index].value?.message}</p>
                    )}
                  </div>
                ))}
                {prizeAmountRootError && <p className="text-red-400 text-xs mt-1">{prizeAmountRootError}</p>}
                <button
                  type="button"
                  onClick={() => appendPrizeAmount({ value: "" })}
                  className="px-4 py-2 bg-black/5 hover:bg-black/10 text-muted-blue text-[10px] font-bold uppercase tracking-widest rounded"
                >
                  Add Prize Amount
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase text-muted-blue tracking-widest block">
                  NFT Token IDs
                </label>
                {prizeTokenIdFields.map((field, index) => (
                  <div key={field.id}>
                    <div className="flex gap-2">
                      <input
                        {...register(`prize_token_ids.${index}.value`)}
                        placeholder="1"
                        className="flex-1 bg-dark-navy border border-black/10 rounded px-4 py-3 text-text-primary font-mono placeholder-muted-blue focus:outline-none focus:ring-1 focus:ring-[#0062df]"
                      />
                      {prizeTokenIdFields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePrizeTokenId(index)}
                          className="px-3 py-2 bg-black/5 hover:bg-black/10 text-muted-blue text-[10px] font-bold uppercase tracking-widest rounded"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {prizeTokenIdFieldErrors?.[index]?.value?.message && (
                      <p className="text-red-400 text-xs mt-1">{prizeTokenIdFieldErrors[index].value?.message}</p>
                    )}
                  </div>
                ))}
                {prizeTokenIdRootError && <p className="text-red-400 text-xs mt-1">{prizeTokenIdRootError}</p>}
                <button
                  type="button"
                  onClick={() => appendPrizeTokenId({ value: "" })}
                  className="px-4 py-2 bg-black/5 hover:bg-black/10 text-muted-blue text-[10px] font-bold uppercase tracking-widest rounded"
                >
                  Add Token ID
                </button>
              </div>
            )}

            {/* Verification Section */}
            <div className="pt-4 border-t border-black/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-blue tracking-widest block mb-1">
                    Prize Verification
                  </label>
                  {address && (
                    <p className="text-[9px] text-muted-blue/70">
                      Checking your wallet: {address.slice(0, 6)}...{address.slice(-4)}
                    </p>
                  )}
                  {/* Debug info */}
                  {process.env.NODE_ENV === "development" && (
                    <div className="text-[9px] text-yellow-400 mt-1 space-y-0.5">
                      <p>Wallet: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}</p>
                      <p>Token: {prizeTokenAddress || "Not set"}</p>
                      <p>Amounts: {prizeAmountsWatch?.map(f => f.value).filter(v => v).join(", ") || "Empty"}</p>
                      <p>Status: {verificationStatus}</p>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleVerifyPrize}
                  disabled={
                    verificationStatus === "verifying" ||
                    !prizeTokenAddress ||
                    !address ||
                    (prizeType === "erc20" && (!prizeAmountsWatch || prizeAmountsWatch.every((f) => !f.value?.trim()))) ||
                    (prizeType !== "erc20" && (!prizeTokenIdsWatch || prizeTokenIdsWatch.every((f) => !f.value?.trim())))
                  }
                  className="px-4 py-2 bg-black/10 hover:bg-black/20 text-[#0062df] text-[10px] font-bold uppercase tracking-widest rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {verificationStatus === "verifying" && (
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {verificationStatus === "verifying" ? "Verifying..." : "Verify Prize"}
                </button>
              </div>

              {verificationStatus === "success" && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-emerald-500 text-xl">check_circle</span>
                    <div className="flex-1">
                      <p className="text-emerald-400 font-medium mb-2">Prize verified successfully!</p>
                      {verificationDetails && (
                        <div className="text-xs text-muted-blue space-y-1">
                          {verificationDetails.name && (
                            <p>Token: {verificationDetails.name} ({verificationDetails.symbol})</p>
                          )}
                          {verificationDetails.balance && (
                            <p>Available Balance: {verificationDetails.balance}</p>
                          )}
                          {verificationDetails.ownerAddress && (
                            <p>Owner: {verificationDetails.ownerAddress}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {verificationStatus === "error" && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-red-400 text-xl">error</span>
                    <div className="flex-1">
                      <p className="text-red-400 font-medium mb-2">Verification failed</p>
                      {verificationError && (
                        <p className="text-xs text-red-300 whitespace-pre-wrap">{verificationError}</p>
                      )}
                      {verificationDetails && verificationDetails.name && (
                        <div className="text-xs text-muted-blue mt-2">
                          <p>Token: {verificationDetails.name} ({verificationDetails.symbol})</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {verificationStatus === "idle" && (
                <div className="p-4 bg-black/5 border border-black/10 rounded">
                  <p className="text-xs text-muted-blue">
                    Verify that the prize tokens/NFTs exist and are owned by your connected admin wallet before creating the raffle. You will transfer prizes to the contract.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded text-red-400">
            {error}
          </div>
        )}

        {verificationStatus !== "success" && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-yellow-500 text-xl">warning</span>
              <div className="flex-1">
                <p className="text-yellow-400 font-medium mb-1">Prize Verification Recommended</p>
                <p className="text-xs text-yellow-300">
                  It's highly recommended to verify your prize tokens/NFTs before creating the raffle to ensure they exist and are owned by your connected wallet.
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || step !== "form"}
          className="w-full py-4 bg-accent-warm hover:brightness-110 text-background font-bold rounded uppercase tracking-[0.15em] text-sm transition-all shadow-[0_0_20px_rgba(0,98,223,0.25)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting && (
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {isSubmitting ? "Creating Raffle..." : "Create Raffle"}
        </button>
      </form>
    </div>
  );
}
