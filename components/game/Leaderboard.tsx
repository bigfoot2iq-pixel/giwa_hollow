'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLeaderboard } from '@/lib/hooks/useLeaderboard';
import { useTokenHolders } from '@/lib/hooks/useTokenHolders';
import { useMultiUser } from '@/lib/hooks/useMultiUser';
import { contracts } from '@/lib/contracts/config';
import type { LeaderboardEntry } from '@/lib/supabase/types';

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
  const [activeTab, setActiveTab] = useState<'game' | 'hollow'>('hollow');
  const { user } = useMultiUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'game') {
      setActiveTab('game');
    } else {
      setActiveTab('hollow');
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'game' | 'hollow') => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`?${params.toString()}`);
  };

  const handleCopy = (wallet: string) => {
    copyToClipboard(wallet);
    setCopiedWallet(wallet);
    setTimeout(() => setCopiedWallet(null), 2000);
  };

  const {
    data: leaderboardData,
    total,
    hasMore: gameHasMore,
    isLoading: gameIsLoading,
    isRefreshing: gameIsRefreshing,
    error: gameError,
    refresh: gameRefresh,
    loadMore: gameLoadMore,
    isEmpty: gameIsEmpty
  } = useLeaderboard({
    limit: 10,
    autoRefresh: activeTab === 'game',
    refreshInterval: 30000,
    currentUserWallet: user?.wallet_address || null
  });

  const {
    holders,
    totalHolders,
    hasMore: holdersHasMore,
    isLoading: holdersIsLoading,
    isRefreshing: holdersIsRefreshing,
    error: holdersError,
    refresh: holdersRefresh,
    loadMore: holdersLoadMore,
    isEmpty: holdersIsEmpty
  } = useTokenHolders({
    tokenAddress: contracts.hollowToken.address,
    autoRefresh: activeTab === 'hollow',
    refreshInterval: 30000
  });

  const isLoading = activeTab === 'game' ? gameIsLoading : holdersIsLoading;
  const isRefreshing = activeTab === 'game' ? gameIsRefreshing : holdersIsRefreshing;
  const error = activeTab === 'game' ? gameError : holdersError;
  const isEmpty = activeTab === 'game' ? gameIsEmpty : holdersIsEmpty;
  const hasMore = activeTab === 'game' ? gameHasMore : holdersHasMore;
  const refresh = activeTab === 'game' ? gameRefresh : holdersRefresh;
  const loadMore = activeTab === 'game' ? gameLoadMore : holdersLoadMore;

  const isLoadingMore = activeTab === 'game' 
    ? (gameIsLoading && leaderboardData.length > 0)
    : (holdersIsLoading && holders.length > 0);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => handleTabChange('hollow')}
          className={`px-4 py-2 font-bold text-xs uppercase tracking-widest rounded transition-all ${
            activeTab === 'hollow'
              ? 'bg-[#ffffff] border border-black/10 text-text-primary'
              : 'bg-black/5 text-foreground hover:bg-black/10 border border-black/20'
          }`}
        >
          Hollow Token
        </button>
        <button
          onClick={() => handleTabChange('game')}
          className={`px-4 py-2 font-bold text-xs uppercase tracking-widest rounded transition-all ${
            activeTab === 'game'
              ? 'bg-[#ffffff] border border-black/10 text-text-primary'
              : 'bg-black/5 text-foreground hover:bg-black/10 border border-black/20'
          }`}
        >
          Game Score
        </button>
      </div>

      {/* Refresh Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <p className="text-xs sm:text-sm text-muted-blue">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
          Live rankings • Updates every 30s
        </p>
        <button
          onClick={refresh}
          disabled={isRefreshing || isLoading}
          className="px-4 py-2 bg-black/5 hover:bg-black/10 text-foreground font-bold rounded uppercase tracking-widest text-xs transition-all border border-black/20 disabled:opacity-50"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Leaderboard Table */}
      <div className="ui-container rounded overflow-hidden">
        {/* Header - Desktop */}
        <div className="hidden md:block bg-black/5 border-b border-black/10 px-4 lg:px-6 py-4">
          {activeTab === 'game' ? (
            <div className="grid grid-cols-12 gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-blue">
              <div className="col-span-1">Rank</div>
              <div className="col-span-8">Wallet</div>
              <div className="col-span-3 text-right">Score</div>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-blue">
              <div className="col-span-1">Rank</div>
              <div className="col-span-7">Wallet</div>
              <div className="col-span-2 text-right">Quantity</div>
              <div className="col-span-2 text-right">Percentage</div>
            </div>
          )}
        </div>

        {/* Header - Mobile */}
        <div className="md:hidden bg-black/5 border-b border-black/10 px-4 py-3">
          <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-blue">
            <div className="col-span-2">Rank</div>
            <div className="col-span-6">Wallet</div>
            <div className="col-span-4 text-right">{activeTab === 'game' ? 'Score' : 'Qty'}</div>
          </div>
        </div>

        {/* Loading State - Only show when no existing data */}
        {isLoading && (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-black/20 border-t-[#0062df] rounded-full animate-spin mb-4"></div>
            <p className="text-muted-blue">
              {activeTab === 'game' ? 'Loading warriors...' : 'Loading holders...'}
            </p>
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
            <p className="text-lg text-text-primary mb-2">
              {activeTab === 'game' ? 'No warriors yet' : 'No holders yet'}
            </p>
            <p className="text-sm text-muted-blue">
              {activeTab === 'game' ? 'Be the first to achieve a high score!' : 'Be the first to claim Hollow Tokens!'}
            </p>
          </div>
        )}

        {/* Leaderboard Entries */}
        {(!isLoading || leaderboardData.length > 0 || holders.length > 0) && !isEmpty && (
          <div className="divide-y divide-black/10">
            {activeTab === 'game' ? (
              // Game Score Table
              leaderboardData.map((player) => {
                const isCurrentUser = user?.wallet_address &&
                  player.wallet_address.toLowerCase() === user.wallet_address.toLowerCase();

                return (
                  <div
                    key={player.wallet_address}
                    className={`hover:bg-black/5 transition-colors ${
                      isCurrentUser ? 'bg-[#0062df]/10 border-l-4 border-[#0062df]' : ''
                    }`}
                  >
                    {/* Desktop Layout */}
                    <div className="hidden md:grid grid-cols-12 gap-4 px-4 lg:px-6 py-4">
                      {/* Rank */}
                      <div className="col-span-1 flex items-center">
                        <span className="text-xl lg:text-2xl">{getRankBadge(player.rank)}</span>
                      </div>

                      {/* Wallet */}
                      <div className="col-span-8 flex items-center gap-2">
                        <code className="font-mono text-xs lg:text-sm text-muted-blue">{formatWallet(player.wallet_address)}</code>
                        <button
                          onClick={() => handleCopy(player.wallet_address)}
                          className="opacity-0 hover:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded"
                          title="Copy address"
                        >
                          <span className="material-symbols-outlined text-xs text-muted-blue">
                            {copiedWallet === player.wallet_address ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>

                      {/* Score */}
                      <div className="col-span-3 flex items-center justify-end">
                        <p className={`text-lg lg:text-xl font-display font-bold ${isCurrentUser ? 'text-[#0062df]' : 'text-text-primary'}`}>
                          {player.game_score.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Mobile Layout */}
                    <div className="md:hidden grid grid-cols-12 gap-2 px-4 py-3">
                      {/* Rank */}
                      <div className="col-span-2 flex items-center">
                        <span className="text-lg">{getRankBadge(player.rank)}</span>
                      </div>

                      {/* Wallet */}
                      <div className="col-span-6 flex items-center gap-2 min-w-0">
                        <code className="font-mono text-xs text-muted-blue truncate">{formatWallet(player.wallet_address)}</code>
                      </div>

                      {/* Score */}
                      <div className="col-span-4 flex items-center justify-end">
                        <p className={`text-base font-display font-bold ${isCurrentUser ? 'text-[#0062df]' : 'text-text-primary'}`}>
                          {player.game_score.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              // Hollow Token Table
              holders.map((holder) => (
                <div
                  key={holder.address}
                  className="hover:bg-black/5 transition-colors"
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
                        className="opacity-0 hover:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded"
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
                      <div className="w-full h-1.5 bg-black/10 rounded overflow-hidden">
                        <div 
                          className="h-full bg-[#0062df] rounded" 
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
              ))
            )}
          </div>
        )}

        {/* Load More */}
        {hasMore && !isLoading && (
          <div className="p-4 lg:p-6 border-t border-black/10 flex justify-center">
            <button
              onClick={loadMore}
              disabled={isLoadingMore}
              className="px-6 lg:px-8 py-2.5 lg:py-3 bg-black/5 hover:bg-black/10 text-text-primary font-bold rounded uppercase tracking-widest text-xs lg:text-sm transition-all border border-black/10 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoadingMore ? (
                <>
                  <div className="w-4 h-4 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin"></div>
                  Loading...
                </>
              ) : (
                activeTab === 'game' ? 'Load More Warriors' : 'Load More Holders'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Call to Action */}
      <div className="ui-container rounded p-6 lg:p-8 text-center">
        <p className="text-muted-blue text-sm lg:text-base mb-4">Ready to claim your place among the legends?</p>
        <button
          onClick={() => router.push('/game')}
          className="px-6 lg:px-8 py-2.5 lg:py-3 bg-[#ffffff] border border-black/10 hover:brightness-125 text-text-primary font-bold rounded uppercase tracking-widest text-xs lg:text-sm transition-all"
        >
          Play Now
        </button>
      </div>
    </div>
  );
}
