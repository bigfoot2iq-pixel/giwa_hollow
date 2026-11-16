'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTokenHolders } from '@/lib/hooks/useTokenHolders';
import { contracts } from '@/lib/contracts/config';

const getRankBadge = (rank: number) => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
};

const formatWallet = (wallet: string) => {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
};

const formatQuantity = (quantity: string) => {
  const num = parseFloat(quantity.replace(/,/g, ''));
  if (isNaN(num)) return quantity;
  if (num >= 1000) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return num.toFixed(2);
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

export default function Leaderboard() {
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);
  const router = useRouter();

  const handleCopy = (wallet: string) => {
    copyToClipboard(wallet);
    setCopiedWallet(wallet);
    setTimeout(() => setCopiedWallet(null), 2000);
  };

  const {
    holders,
    hasMore,
    isLoading,
    isRefreshing,
    error,
    refresh,
    loadMore,
    isEmpty
  } = useTokenHolders({
    tokenAddress: contracts.ariwaToken.address,
    autoRefresh: true,
    refreshInterval: 30000
  });

  const isLoadingMore = isLoading && holders.length > 0;

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Refresh Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <p className="text-xs sm:text-sm text-muted-blue">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
          Live rankings • Updates every 30s
        </p>
        <button
          onClick={refresh}
          disabled={isRefreshing || isLoading}
          className="px-4 py-2 bg-ink/[0.04] hover:bg-ink/[0.07] text-foreground font-bold rounded uppercase tracking-widest text-xs transition-all border border-ink/15 disabled:opacity-50"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Leaderboard Table */}
      <div className="ui-container rounded overflow-hidden">
        {/* Header - Desktop */}
        <div className="hidden md:block bg-ink/[0.04] border-b border-ink/10 px-4 lg:px-6 py-4">
          <div className="grid grid-cols-12 gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-blue">
            <div className="col-span-1">Rank</div>
            <div className="col-span-7">Wallet</div>
            <div className="col-span-2 text-right">Quantity</div>
            <div className="col-span-2 text-right">Percentage</div>
          </div>
        </div>

        {/* Header - Mobile */}
        <div className="md:hidden bg-ink/[0.04] border-b border-ink/10 px-4 py-3">
          <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-blue">
            <div className="col-span-2">Rank</div>
            <div className="col-span-6">Wallet</div>
            <div className="col-span-4 text-right">Qty</div>
          </div>
        </div>

        {/* Loading State - Only show when no existing data */}
        {isLoading && holders.length === 0 && (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-ink/15 border-t-[#6c55e0] rounded-full animate-spin mb-4"></div>
            <p className="text-muted-blue">Loading holders...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-red-500 text-5xl mb-4 block">error</span>
            <p className="text-text-primary">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {isEmpty && !isLoading && (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-muted-blue text-6xl mb-4 block">emoji_events</span>
            <p className="text-lg text-text-primary mb-2">No holders yet</p>
            <p className="text-sm text-muted-blue">Be the first to hold Ariwa Tokens!</p>
          </div>
        )}

        {/* Leaderboard Entries */}
        {(!isLoading || holders.length > 0) && !isEmpty && (
          <div className="divide-y divide-ink/10">
            {holders.map((holder) => (
              <div
                key={holder.address}
                className="hover:bg-ink/[0.04] transition-colors"
              >
                {/* Desktop Layout */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-4 lg:px-6 py-4">
                  {/* Rank */}
                  <div className="col-span-1 flex items-center">
                    <span className="text-xl lg:text-2xl">{getRankBadge(holder.rank)}</span>
                  </div>

                  {/* Wallet */}
                  <div className="col-span-7 flex items-center gap-2">
                    <code className="font-mono text-xs lg:text-sm text-muted-blue">{formatWallet(holder.address)}</code>
                    {holder.nameTag && (
                      <span className="text-xs text-muted-blue hidden lg:inline">({holder.nameTag})</span>
                    )}
                    <button
                      onClick={() => handleCopy(holder.address)}
                      className="opacity-0 hover:opacity-100 transition-opacity p-1 hover:bg-ink/[0.07] rounded"
                      title="Copy address"
                    >
                      <span className="material-symbols-outlined text-xs text-muted-blue">
                        {copiedWallet === holder.address ? 'check' : 'content_copy'}
                      </span>
                    </button>
                  </div>

                  {/* Quantity */}
                  <div className="col-span-2 flex items-center justify-end">
                    <p className="text-lg lg:text-xl font-display font-bold text-text-primary">
                      {formatQuantity(holder.quantity)}
                    </p>
                  </div>

                  {/* Percentage */}
                  <div className="col-span-2 flex flex-col items-end justify-center pl-6">
                    <p className="text-sm font-bold text-text-primary mb-1">{holder.percentage}</p>
                    <div className="w-full h-1.5 bg-ink/[0.07] rounded overflow-hidden">
                      <div
                        className="h-full bg-iris-strong rounded"
                        style={{ width: holder.percentage }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Mobile Layout */}
                <div className="md:hidden grid grid-cols-12 gap-2 px-4 py-3">
                  {/* Rank */}
                  <div className="col-span-2 flex items-center">
                    <span className="text-lg">{getRankBadge(holder.rank)}</span>
                  </div>

                  {/* Wallet */}
                  <div className="col-span-6 flex items-center gap-2 min-w-0">
                    <code className="font-mono text-xs text-muted-blue truncate">{formatWallet(holder.address)}</code>
                  </div>

                  {/* Quantity */}
                  <div className="col-span-4 flex items-center justify-end">
                      <p className="text-base font-display font-bold text-text-primary">
                      {formatQuantity(holder.quantity)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && !isEmpty && (
          <div className="p-4 lg:p-6 border-t border-ink/10 flex justify-center">
            <button
              onClick={loadMore}
              disabled={isLoadingMore}
              className="px-6 lg:px-8 py-2.5 lg:py-3 bg-ink/[0.04] hover:bg-ink/[0.07] text-text-primary font-bold rounded uppercase tracking-widest text-xs lg:text-sm transition-all border border-ink/10 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoadingMore ? (
                <>
                  <div className="w-4 h-4 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin"></div>
                  Loading...
                </>
              ) : (
                'Load More Holders'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Call to Action */}
      <div className="ui-container rounded p-6 lg:p-8 text-center">
        <p className="text-muted-blue text-sm lg:text-base mb-4">Ready to put your ARIWA to work?</p>
        <button
          onClick={() => router.push('/raffles')}
          className="px-6 lg:px-8 py-2.5 lg:py-3 bg-accent-warm hover:brightness-110 text-background font-bold rounded uppercase tracking-widest text-xs lg:text-sm transition-all"
        >
          Explore Raffles
        </button>
      </div>
    </div>
  );
}
