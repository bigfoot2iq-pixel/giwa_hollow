"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useTokenBalance, formatTokenBalance } from "@/lib/hooks";

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useTokenBalance(address);

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Page Title */}
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-header text-foreground mb-4 lg:mb-8">Profile Overview</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-8 lg:mb-12">
        <div className="ui-container p-4 lg:p-6 rounded border-l-4 border-white/20">
          <p className="text-muted-blue text-[10px] font-bold uppercase tracking-widest mb-2">Token Balance</p>
          <p className="text-2xl lg:text-3xl font-display font-bold text-text-primary">
            {isConnected && balance !== undefined ? formatTokenBalance(balance) : "0.00"} GIWA
          </p>
        </div>
        <div className="ui-container p-4 lg:p-6 rounded">
          <p className="text-muted-blue text-[10px] font-bold uppercase tracking-widest mb-2">Active Entries</p>
          <p className="text-2xl lg:text-3xl font-display font-bold text-text-primary">0</p>
        </div>
        <div className="ui-container p-4 lg:p-6 rounded sm:col-span-2 lg:col-span-1">
          <p className="text-muted-blue text-[10px] font-bold uppercase tracking-widest mb-2">Total Wins</p>
          <p className="text-2xl lg:text-3xl font-display font-bold text-text-primary">0</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Browse Raffles Card */}
        <div className="ui-container rounded overflow-hidden flex flex-col">
          <div className="p-6 lg:p-8 border-b border-white/10 flex flex-col flex-1">
            <div className="flex items-center gap-3 lg:gap-4 mb-4 lg:mb-6">
              <div className="w-12 h-12 lg:w-14 lg:h-14 bg-[#0c1512] border border-white/10 flex items-center justify-center rounded-xl flex-shrink-0">
                <span className="material-symbols-outlined text-[#2ee6a6]" style={{ fontSize: 28 }}>confirmation_number</span>
              </div>
              <div>
                <h3 className="text-xl lg:text-2xl font-header text-text-primary">Browse Raffles</h3>
                <p className="text-muted-blue text-xs lg:text-sm">Explore active and upcoming raffles</p>
              </div>
            </div>
            <p className="text-muted-blue text-xs lg:text-sm leading-relaxed mb-4 lg:mb-6 flex-1">
              Find exciting raffles with prizes ranging from ERC20 token pools to rare NFTs and composable ERC6220 collections — plus raffles created by the community.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/raffles" className="flex-1">
                <button className="w-full py-3 lg:py-4 bg-[#0c1512] border border-white/10 hover:brightness-125 text-text-primary font-bold rounded uppercase tracking-[0.15em] text-xs lg:text-sm transition-all">
                  View Raffles
                </button>
              </Link>
              <Link href="/community-raffles" className="flex-1">
                <button className="w-full py-3 lg:py-4 bg-white/5 hover:bg-white/10 text-text-primary font-bold rounded uppercase tracking-[0.15em] text-xs lg:text-sm transition-all border border-white/10 flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>groups</span>
                  Community
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Game Card */}
        <div className="ui-container rounded overflow-hidden flex flex-col">
          <div className="p-6 lg:p-8 border-b border-white/10 flex flex-col flex-1">
            <div className="flex items-center gap-3 lg:gap-4 mb-4 lg:mb-6">
              <div className="w-12 h-12 lg:w-14 lg:h-14 bg-[#0c1512] border border-white/10 flex items-center justify-center rounded-xl flex-shrink-0">
                <span className="material-symbols-outlined text-[#2ee6a6]" style={{ fontSize: 28 }}>sports_esports</span>
              </div>
              <div>
                <h3 className="text-xl lg:text-2xl font-header text-text-primary">Play the Game</h3>
                <p className="text-muted-blue text-xs lg:text-sm">Jump in and start earning</p>
              </div>
            </div>
            <p className="text-muted-blue text-xs lg:text-sm leading-relaxed mb-4 lg:mb-6 flex-1">
              Play to earn tokens, climb the leaderboard, and use your rewards to enter raffles.
            </p>
            <Link href="/game">
              <button className="w-full py-3 lg:py-4 bg-[#0c1512] border border-white/10 hover:brightness-125 text-text-primary font-bold rounded uppercase tracking-[0.15em] text-xs lg:text-sm transition-all">
                Play Game
              </button>
            </Link>
          </div>
        </div>

      </div>

      {/* How It Works */}
      <div className="ui-container rounded p-6 lg:p-8">
        <h3 className="text-xl lg:text-2xl font-header text-text-primary mb-6 lg:mb-8">How It Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#0c1512] border border-white/10 flex items-center justify-center text-[#2ee6a6] font-bold text-lg mb-4">
              1
            </div>
            <h4 className="text-text-primary font-bold mb-2 text-sm lg:text-base">Connect Wallet</h4>
            <p className="text-muted-blue text-xs lg:text-sm">Connect your wallet to the Katana Network</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#0c1512] border border-white/10 flex items-center justify-center text-[#2ee6a6] font-bold text-lg mb-4">
              2
            </div>
            <h4 className="text-text-primary font-bold mb-2 text-sm lg:text-base">Claim Daily Tokens</h4>
            <p className="text-muted-blue text-xs lg:text-sm">Claim your daily free tokens</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#0c1512] border border-white/10 flex items-center justify-center text-[#2ee6a6] font-bold text-lg mb-4">
              3
            </div>
            <h4 className="text-text-primary font-bold mb-2 text-sm lg:text-base">Enter Raffles</h4>
            <p className="text-muted-blue text-xs lg:text-sm">Use tokens to enter active raffles</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#0c1512] border border-white/10 flex items-center justify-center text-[#2ee6a6] font-bold text-lg mb-4">
              4
            </div>
            <h4 className="text-text-primary font-bold mb-2 text-sm lg:text-base">Win Prizes</h4>
            <p className="text-muted-blue text-xs lg:text-sm">Winners receive prizes automatically</p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="ui-container rounded p-5 lg:p-6">
          <div className="w-10 h-10 rounded bg-[#2ee6a6]/20 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[#2ee6a6]">shield</span>
          </div>
          <h4 className="text-text-primary font-bold mb-2 text-sm lg:text-base">Fair & Secure</h4>
          <p className="text-muted-blue text-xs lg:text-sm">Commit-reveal scheme ensures no manipulation</p>
        </div>
        <div className="ui-container rounded p-5 lg:p-6">
          <div className="w-10 h-10 rounded bg-[#2ee6a6]/20 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[#2ee6a6]">trophy</span>
          </div>
          <h4 className="text-text-primary font-bold mb-2 text-sm lg:text-base">Multiple Prize Types</h4>
          <p className="text-muted-blue text-xs lg:text-sm">ERC20, ERC721, and ERC6220 prizes</p>
        </div>
        <div className="ui-container rounded p-5 lg:p-6 sm:col-span-2 lg:col-span-1">
          <div className="w-10 h-10 rounded bg-[#2ee6a6]/20 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[#2ee6a6]">bolt</span>
          </div>
          <h4 className="text-text-primary font-bold mb-2 text-sm lg:text-base">Auto Distribution</h4>
          <p className="text-muted-blue text-xs lg:text-sm">Prizes sent directly to your wallet</p>
        </div>
      </div>
    </div>
  );
}
