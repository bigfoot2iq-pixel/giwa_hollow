"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { RaffleEntryForm } from "@/components/raffle";
import type { Prize, PrizeType, Raffle, RaffleStatus, Winner } from "@/lib/supabase";
import { getTokenMetadataCached, fromTokenUnits } from "@/lib/utils/erc20";
import { contracts } from "@/lib/contracts/config";

const prizeTypeLabels: Record<PrizeType, string> = {
  erc20: "Token",
  erc721: "NFT",
  erc6220: "ERC6220",
};

interface RaffleData {
  raffle: Raffle & { status: RaffleStatus };
  entriesCount: number;
  participantsCount: number;
  prizes: Prize[];
  winners: Winner[];
}

interface EntryData {
  wallet_address: string;
  entry_count: number;
  tx_hash: string;
  created_at: string;
}

interface PrizeWithMetadata extends Prize {
  tokenName?: string;
  tokenSymbol?: string;
  formattedAmount?: string | null;
}

export default function RaffleDetailView() {
  const params = useParams();
  const pathname = usePathname();
  const isCommunity = pathname.startsWith("/community-raffles");
  const [data, setData] = useState<RaffleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entryTokenSymbol, setEntryTokenSymbol] = useState<string>("HOLLOW");
  const [prizesWithMetadata, setPrizesWithMetadata] = useState<PrizeWithMetadata[]>([]);

  // Entries pagination state
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [entriesPage, setEntriesPage] = useState(0);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [hasMoreEntries, setHasMoreEntries] = useState(true);
  const [totalEntriesCount, setTotalEntriesCount] = useState(0);
  const [walletSearch, setWalletSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Use ref to prevent race conditions
  const fetchingRef = useRef(false);

  const fetchRaffle = useCallback(async () => {
    if (!params.id) return;

    try {
      const response = await fetch(`/api/raffles/${params.id}`);
      const result = await response.json();

      if (response.ok) {
        setData(result);
        setTotalEntriesCount(result.participantsCount || 0);
      } else {
        setError(result.error || "Failed to load raffle");
      }
    } catch (err) {
      setError("Failed to load raffle");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const fetchEntries = useCallback(async (page: number, wallet = "") => {
    if (!params.id || fetchingRef.current) return;

    fetchingRef.current = true;
    setEntriesLoading(true);
    try {
      const walletParam = wallet ? `&wallet=${encodeURIComponent(wallet)}` : "";
      const response = await fetch(`/api/raffles/${params.id}/entries?page=${page}&limit=10${walletParam}`);
      const result = await response.json();

      if (response.ok) {
        setEntries(prev => page === 0 ? result.entries : [...prev, ...result.entries]);
        setHasMoreEntries(result.hasMore);
        setTotalEntriesCount(result.total);
      } else {
        console.error("Failed to load entries:", result.error);
      }
    } catch (err) {
      console.error("Failed to load entries:", err);
    } finally {
      setEntriesLoading(false);
      fetchingRef.current = false;
    }
  }, [params.id]);

  const handleEntrySuccess = useCallback(async () => {
    // Refresh raffle data (participants count, entries count)
    await fetchRaffle();

    // Refresh entries list from the beginning
    setEntries([]);
    setEntriesPage(0);
    setHasMoreEntries(true);
    await fetchEntries(0, walletSearch);
  }, [fetchRaffle, fetchEntries, walletSearch]);

  useEffect(() => {
    setLoading(true);
    fetchRaffle();
  }, [params.id, fetchRaffle]);

  // Fetch initial entries
  useEffect(() => {
    if (params.id) {
      setEntries([]);
      setEntriesPage(0);
      setHasMoreEntries(true);
      fetchEntries(0, walletSearch);
    }
  }, [params.id, walletSearch, fetchEntries]);

  // Fetch entry token metadata
  useEffect(() => {
    const fetchEntryTokenMetadata = async () => {
      const metadata = await getTokenMetadataCached(contracts.hollowToken.address, false);
      if (metadata) {
        setEntryTokenSymbol(metadata.symbol);
      }
    };
    fetchEntryTokenMetadata();
  }, []);

  // Fetch prize metadata
  useEffect(() => {
    const fetchPrizeMetadata = async () => {
      if (!data?.prizes) return;

      const prizesWithMeta = await Promise.all(
        data.prizes.map(async (prize) => {
          const isNFT = prize.prize_type === "erc721" || prize.prize_type === "erc6220";
          const metadata = await getTokenMetadataCached(prize.prize_token_address, isNFT);

          let formattedAmount = prize.prize_amount;
          if (prize.prize_type === "erc20" && prize.prize_amount && metadata) {
            // Assuming 18 decimals for ERC20 tokens, you may want to fetch this dynamically
            formattedAmount = fromTokenUnits(prize.prize_amount, 18);
          }

          return {
            ...prize,
            tokenName: metadata?.name,
            tokenSymbol: metadata?.symbol,
            formattedAmount,
          };
        })
      );

      setPrizesWithMetadata(prizesWithMeta);
    };

    fetchPrizeMetadata();
  }, [data?.prizes]);

  // Load more entries when user clicks button
  const handleLoadMore = () => {
    if (entriesLoading || !hasMoreEntries) return;

    const nextPage = entriesPage + 1;
    setEntriesPage(nextPage);
    fetchEntries(nextPage, walletSearch);
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setWalletSearch(searchInput);
    setEntriesPage(0);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchInput("");
    setWalletSearch("");
    setEntriesPage(0);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="ui-container rounded h-64 animate-pulse" />
        <div className="ui-container rounded h-48 animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="ui-container rounded p-16 text-center">
        <span className="material-symbols-outlined text-red-400 text-6xl mb-4 block">error</span>
        <p className="text-lg text-red-400">{error || "Raffle not found"}</p>
      </div>
    );
  }

  const { raffle, entriesCount, participantsCount, prizes, winners } = data;
  const startDate = new Date(raffle.start_date);
  const endDate = new Date(raffle.end_date);
  const prizeTypes = prizes.map((prize) => prize.prize_type);
  const uniquePrizeTypes = Array.from(new Set(prizeTypes));
  const primaryPrizeType = uniquePrizeTypes[0];
  const isNFT = uniquePrizeTypes.some((type) => type === "erc721" || type === "erc6220");
  const prizeLabel =
    uniquePrizeTypes.length === 0
      ? "TBD"
      : uniquePrizeTypes.length === 1 && primaryPrizeType
        ? prizeTypeLabels[primaryPrizeType]
        : "Multiple";

  // Get prize display info from metadata
  const prizeDisplayInfo = prizesWithMetadata.length > 0 ? prizesWithMetadata[0] : null;
  const prizeInfoLabel = prizeDisplayInfo
    ? prizeDisplayInfo.prize_type === "erc20"
      ? `${prizeDisplayInfo.formattedAmount || "0"} ${prizeDisplayInfo.tokenSymbol || "Token"}`
      : `${prizeDisplayInfo.tokenName || "NFT"} #${prizeDisplayInfo.prize_token_id || "?"}`
    : "TBD";

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href={isCommunity ? "/community-raffles" : "/raffles"} className="text-black hover:opacity-70 transition-opacity">
          {isCommunity ? "Community Raffles" : "Raffles"}
        </Link>
        <span className="text-black">/</span>
        <span className="text-black">{raffle.title}</span>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero Image */}
          <div className="ui-container rounded overflow-hidden">
            <div className={`h-64 relative ${isNFT ? "overflow-hidden" : "bg-dark-navy flex items-center justify-center"}`}>
              {raffle.image_url ? (
                <Image
                  src={raffle.image_url}
                  alt={raffle.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 66vw"
                />
              ) : isNFT ? (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-muted-blue text-8xl">image</span>
                </div>
              ) : (
                <Image
                  alt="LITVM"
                  width={153}
                  height={96}
                  unoptimized
                  className="object-contain"
                  src="/litvm/logo-letter.svg"
                />
              )}
              <div className="absolute top-4 left-4 flex gap-2">
                <span className="bg-[#ffffff] text-[#0062df] text-[10px] font-bold px-3 py-1 rounded uppercase tracking-widest">
                  {prizeLabel}
                </span>
                <span className={`text-[10px] font-bold px-3 py-1 rounded uppercase tracking-widest ${raffle.status === "active"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : raffle.status === "pending"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-black/10 text-muted-blue border border-black/10"
                  }`}>
                  {raffle.status}
                </span>
              </div>
            </div>
            <div className="p-6">
              <h1 className="text-3xl font-header text-text-primary mb-4">{raffle.title}</h1>
              <p className="text-muted-blue leading-relaxed">{raffle.description}</p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="ui-container rounded p-6">
            <h3 className="text-xl font-header text-text-primary mb-6">Raffle Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-blue tracking-widest mb-1">Entry Cost</p>
                <p className="text-lg font-display font-bold text-[#0062df]">{raffle.tokens_required} {entryTokenSymbol}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-blue tracking-widest mb-1">Max Entries / User</p>
                <p className="text-lg font-display font-bold text-text-primary">{raffle.max_entries_per_user}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-blue tracking-widest mb-1">Participants</p>
                <p className="text-lg font-display font-bold text-text-primary">
                  {participantsCount} / {raffle.max_participants}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-blue tracking-widest mb-1">Total Entries</p>
                <p className="text-lg font-display font-bold text-text-primary">{entriesCount}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-blue tracking-widest mb-1">Start Date</p>
                <p className="text-sm font-bold text-text-primary">{format(startDate, "MMM d, yyyy")}</p>
                <p className="text-[10px] text-muted-blue">{format(startDate, "h:mm a")}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-blue tracking-widest mb-1">End Date</p>
                <p className="text-sm font-bold text-text-primary">{format(endDate, "MMM d, yyyy")}</p>
                <p className="text-[10px] text-muted-blue">{format(endDate, "h:mm a")}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-blue tracking-widest mb-1">Winners</p>
                <p className="text-lg font-display font-bold text-text-primary">{prizes.length}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-blue tracking-widest mb-1">Prize</p>
                <p className="text-sm font-bold text-[#0062df]">{prizeInfoLabel}</p>
              </div>
            </div>
          </div>

          {/* Entries */}
          <div className="ui-container rounded overflow-hidden">
            <div className="px-6 py-4 border-b border-black/10">
              <h3 className="text-xl font-header text-text-primary">Entries</h3>
              <p className="text-sm text-muted-blue mt-1">
                {totalEntriesCount} entr{totalEntriesCount !== 1 ? 'ies' : 'y'} • {entriesCount} total entries
              </p>

              {/* Search Input */}
              <form onSubmit={handleSearch} className="mt-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search by wallet address..."
                      className="w-full px-4 py-2 bg-black/5 border border-black/10 rounded text-text-primary placeholder-muted-blue focus:outline-none focus:border-[#0062df]/50 transition-colors"
                    />
                    {searchInput && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-blue hover:text-text-primary transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={entriesLoading}
                    className="px-4 py-2 bg-[#ffffff] text-text-primary font-bold rounded border border-black/10 hover:brightness-125 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">search</span>
                    Search
                  </button>
                </div>
                {walletSearch && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="text-muted-blue">Filtering by:</span>
                    <span className="px-2 py-1 bg-[#0062df]/10 text-[#0062df] rounded font-mono text-xs">
                      {walletSearch}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="text-muted-blue hover:text-[#0062df] transition-colors text-xs underline"
                    >
                      Clear filter
                    </button>
                  </div>
                )}
              </form>
            </div>
            {/* Scrollable entries container with max height */}
            <div className="max-h-[600px] overflow-y-auto">
              <div className="p-6">
                {entries.length > 0 ? (
                  <>
                    <ul className="space-y-3">
                      {entries.map((entry, index) => (
                        <li key={`${entry.tx_hash}-${index}`}>
                          <Link
                            href={`https://katanascan.com/tx/${entry.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 bg-black/5 rounded border border-black/10 hover:bg-black/10 hover:border-[#0062df]/30 transition-all group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 rounded-full bg-[#ffffff] flex items-center justify-center text-[#0062df] text-sm font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-mono text-text-primary text-sm group-hover:text-[#0062df] transition-colors">
                                  {entry.wallet_address.slice(0, 10)}...{entry.wallet_address.slice(-8)}
                                </p>
                                <p className="text-[10px] text-muted-blue mt-0.5">
                                  {format(new Date(entry.created_at), "MMM d, yyyy 'at' h:mm a")}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-display font-bold text-[#0062df]">
                                {entry.entry_count} {entry.entry_count === 1 ? 'entry' : 'entries'}
                              </span>
                              <span className="material-symbols-outlined text-muted-blue group-hover:text-[#0062df] transition-colors text-lg">
                                open_in_new
                              </span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>

                    {/* Load More Button */}
                    {hasMoreEntries && (
                      <div className="mt-6 text-center">
                        <button
                          onClick={handleLoadMore}
                          disabled={entriesLoading}
                          className="px-6 py-3 bg-[#ffffff] text-text-primary font-bold rounded border border-black/10 hover:brightness-125 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {entriesLoading ? "Loading..." : "Load More"}
                        </button>
                      </div>
                    )}
                  </>
                ) : entriesLoading ? (
                  <div className="text-center py-6">
                    <p className="text-muted-blue">Loading entries...</p>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <span className="material-symbols-outlined text-muted-blue text-4xl mb-2 block">receipt_long</span>
                    <p className="text-muted-blue">No entries yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Right Side - Entry Form or Winners */}
        <div>
          <div className="ui-container rounded overflow-hidden sticky top-24">
            {raffle.status === "ended" ? (
              <>
                <div className="px-6 py-4 border-b border-black/10 bg-black/5">
                  <h3 className="text-xl font-header text-text-primary">Winners</h3>
                </div>
                <div className="p-6">
                  {winners && winners.length > 0 ? (
                    <ul className="space-y-3">
                      {winners.map((winner, index) => (
                        <li key={winner.id}>
                          <Link
                            href={winner.distribution_tx_hash ? `https://katanascan.com/tx/${winner.distribution_tx_hash}` : "#"}
                            target={winner.distribution_tx_hash ? "_blank" : undefined}
                            rel={winner.distribution_tx_hash ? "noopener noreferrer" : undefined}
                            className={`flex items-center justify-between p-4 bg-black/5 rounded border border-black/10 ${winner.distribution_tx_hash
                              ? "hover:bg-black/10 hover:border-[#0062df]/30 transition-all group cursor-pointer"
                              : ""
                              }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 rounded-full bg-[#ffffff] flex items-center justify-center text-[#0062df] text-sm font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <p className={`font-mono text-text-primary text-sm ${winner.distribution_tx_hash ? "group-hover:text-[#0062df] transition-colors" : ""}`}>
                                  {winner.wallet_address.slice(0, 10)}...{winner.wallet_address.slice(-8)}
                                </p>
                                {winner.distribution_tx_hash && (
                                  <p className="text-[10px] text-muted-blue mt-0.5 font-mono">
                                    {winner.distribution_tx_hash.slice(0, 10)}...{winner.distribution_tx_hash.slice(-8)}
                                  </p>
                                )}
                              </div>
                            </div>
                            {winner.distribution_tx_hash && (
                              <span className="material-symbols-outlined text-muted-blue group-hover:text-[#0062df] transition-colors text-lg">
                                open_in_new
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-center py-6">
                      <span className="material-symbols-outlined text-muted-blue text-4xl mb-2 block">emoji_events</span>
                      <p className="text-muted-blue">No winners selected</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-black/10 bg-black/5">
                  <h3 className="text-xl font-header text-text-primary">Enter Raffle</h3>
                </div>
                <div className="p-6">
                  <RaffleEntryForm
                    raffle={raffle}
                    chainRaffleId={raffle.chain_raffle_id || 0}
                    participantsCount={participantsCount}
                    onSuccess={handleEntrySuccess}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
