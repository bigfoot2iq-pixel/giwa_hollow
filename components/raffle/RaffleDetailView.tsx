"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { RaffleEntryForm } from "@/components/raffle";
import type { Prize, PrizeType, Raffle, RaffleStatus, Winner } from "@/lib/supabase";
import { getTokenMetadataCached, fromTokenUnits } from "@/lib/utils/erc20";
import { contracts, giwaSepolia } from "@/lib/contracts/config";

const EXPLORER_TX_URL = `${giwaSepolia.blockExplorers?.default.url ?? "https://sepolia-explorer.giwa.io"}/tx`;

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
  const [data, setData] = useState<RaffleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entryTokenSymbol, setEntryTokenSymbol] = useState<string>("ARIWA");
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
        // Joiner total lives in the Participants stat (result.participantsCount).
        // totalEntriesCount is the Entries-list count and is owned solely by
        // fetchEntries — setting it here too would race the list total (and, when
        // participants_display overrides the joiner count, disagree with it).
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
      const metadata = await getTokenMetadataCached(contracts.ariwaToken.address, false);
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
        <span className="material-symbols-outlined text-red-600 dark:text-red-300 text-6xl mb-4 block">error</span>
        <p className="text-lg text-red-600 dark:text-red-300">{error || "Raffle not found"}</p>
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
    <div className="page-shell space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em]">
        <Link href="/raffles" className="text-ink-mute transition-colors hover:text-iris">
          Raffles
        </Link>
        <span className="text-ink-faint">/</span>
        <span className="truncate text-ink">{raffle.title}</span>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero Image */}
          <div className="ui-container overflow-hidden rounded-[26px]">
            <div className={`relative h-64 sm:h-80 ${isNFT ? "overflow-hidden" : "flex items-center justify-center bg-[linear-gradient(135deg,#FFF8DE_0%,#FBE7EF_55%,#E4F0FB_100%)] dark:bg-[linear-gradient(135deg,#221c0f_0%,#2a1620_55%,#162230_100%)]"}`}>
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
                  alt="ARIWA"
                  width={128}
                  height={128}
                  className="size-28 rounded-[26px] object-cover shadow-[0_18px_40px_-24px_rgba(39,33,50,0.6)] dark:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.85)]"
                  src="/brand/ariwa-icon.webp"
                />
              )}
              <div className="absolute left-4 top-4 flex gap-2">
                <span className="rounded-full border border-ink/10 bg-paper/85 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft backdrop-blur">
                  {prizeLabel}
                </span>
                <span className={`rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] backdrop-blur ${raffle.status === "active"
                  ? "border-success/25 bg-success-strong/90 text-white"
                  : raffle.status === "pending"
                    ? "border-iris/20 bg-iris-strong/90 text-white"
                    : "border-ink/10 bg-paper/85 text-ink-mute"
                  }`}>
                  {raffle.status}
                </span>
              </div>
            </div>
            <div className="p-6 sm:p-8">
              <h1 className="font-header text-3xl font-extrabold tracking-[-0.04em] text-ink sm:text-4xl">{raffle.title}</h1>
              <p className="mt-3 max-w-2xl text-[13px] leading-6 text-ink-soft">{raffle.description}</p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="ui-container rounded-[26px] p-6 sm:p-8">
            <h3 className="font-header text-xl font-extrabold tracking-[-0.03em] text-ink">Raffle details</h3>
            <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-blue tracking-widest mb-1">Entry Cost</p>
                <p className="text-lg font-display font-bold text-iris">{raffle.tokens_required} {entryTokenSymbol}</p>
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
                <p className="text-sm font-bold text-iris">{prizeInfoLabel}</p>
              </div>
            </div>
          </div>

          {/* Entries */}
          <div className="ui-container overflow-hidden rounded-[26px]">
            <div className="border-b border-ink/[0.08] px-6 py-5">
              <h3 className="font-header text-xl font-extrabold tracking-[-0.03em] text-ink">Entries</h3>
              <p className="mt-1 text-[11px] text-ink-mute">
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
                      className="w-full px-4 py-2 bg-ink/[0.04] border border-ink/10 rounded text-text-primary placeholder-muted-blue focus:outline-none focus:border-iris/50 transition-colors"
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
                    className="px-4 py-2 bg-accent-warm text-background font-bold rounded hover:brightness-110 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">search</span>
                    Search
                  </button>
                </div>
                {walletSearch && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="text-muted-blue">Filtering by:</span>
                    <span className="px-2 py-1 bg-iris/10 text-iris rounded font-mono text-xs">
                      {walletSearch}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="text-muted-blue hover:text-iris transition-colors text-xs underline"
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
                            href={`${EXPLORER_TX_URL}/${entry.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 bg-ink/[0.04] rounded border border-ink/10 hover:bg-ink/[0.07] hover:border-iris/30 transition-all group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 rounded-full bg-paper flex items-center justify-center text-iris text-sm font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-mono text-text-primary text-sm group-hover:text-iris transition-colors">
                                  {entry.wallet_address.slice(0, 10)}...{entry.wallet_address.slice(-8)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-display font-bold text-iris">
                                {entry.entry_count} {entry.entry_count === 1 ? 'entry' : 'entries'}
                              </span>
                              <span className="material-symbols-outlined text-muted-blue group-hover:text-iris transition-colors text-lg">
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
                          className="px-6 py-3 bg-accent-warm text-background font-bold rounded hover:brightness-110 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="ui-container overflow-hidden rounded-[26px] sticky top-24">
            {raffle.status === "ended" ? (
              <>
                <div className="border-b border-ink/[0.08] bg-cream/50 px-6 py-4">
                  <h3 className="font-header text-xl font-extrabold tracking-[-0.03em] text-ink">Winners</h3>
                </div>
                <div className="p-6">
                  {winners && winners.length > 0 ? (
                    <ul className="space-y-3">
                      {winners.map((winner, index) => (
                        <li key={winner.id}>
                          <Link
                            href={winner.distribution_tx_hash ? `${EXPLORER_TX_URL}/${winner.distribution_tx_hash}` : "#"}
                            target={winner.distribution_tx_hash ? "_blank" : undefined}
                            rel={winner.distribution_tx_hash ? "noopener noreferrer" : undefined}
                            className={`flex items-center justify-between p-4 bg-ink/[0.04] rounded border border-ink/10 ${winner.distribution_tx_hash
                              ? "hover:bg-ink/[0.07] hover:border-iris/30 transition-all group cursor-pointer"
                              : ""
                              }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 rounded-full bg-paper flex items-center justify-center text-iris text-sm font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <p className={`font-mono text-text-primary text-sm ${winner.distribution_tx_hash ? "group-hover:text-iris transition-colors" : ""}`}>
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
                              <span className="material-symbols-outlined text-muted-blue group-hover:text-iris transition-colors text-lg">
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
                <div className="border-b border-ink/[0.08] bg-cream/50 px-6 py-4">
                  <h3 className="font-header text-xl font-extrabold tracking-[-0.03em] text-ink">Enter raffle</h3>
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
