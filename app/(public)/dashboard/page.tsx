"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useTokenBalance, formatTokenBalance } from "@/lib/hooks";

const STATS = [
  { label: "Token Balance", icon: "toll" },
  { label: "Active Entries", icon: "confirmation_number" },
  { label: "Total Wins", icon: "trophy" },
] as const;

const STEPS = [
  { n: 1, title: "Connect Wallet", note: "Connect your wallet to GIWA Sepolia" },
  { n: 2, title: "Claim Tokens", note: "Mint ARIWA tokens to get started" },
  { n: 3, title: "Enter Raffles", note: "Use tokens to enter active raffles" },
  { n: 4, title: "Win Prizes", note: "Winners receive prizes automatically" },
] as const;

const FEATURES = [
  { icon: "shield", title: "Fair & Secure", note: "Commit-reveal scheme ensures no manipulation" },
  { icon: "trophy", title: "Multiple Prize Types", note: "ERC20, ERC721, and ERC6220 prizes" },
  { icon: "bolt", title: "Auto Distribution", note: "Prizes sent directly to your wallet", wide: true },
] as const;

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useTokenBalance(address);

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Page Title */}
      <h2 className="mb-4 text-3xl font-header text-foreground sm:text-4xl lg:mb-8 lg:text-5xl">Profile Overview</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {STATS.map((s, i) => (
          <div
            key={s.label}
            className={`ui-container rounded-2xl p-5 lg:p-6 ${i === 2 ? "sm:col-span-2 lg:col-span-1" : ""}`}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-warm/15 text-accent-warm">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{s.icon}</span>
              </span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">{s.label}</p>
            </div>
            <p className="font-display text-2xl font-bold text-text-primary lg:text-3xl">
              {s.label === "Token Balance"
                ? `${isConnected && balance !== undefined ? formatTokenBalance(balance) : "0.00"} ARIWA`
                : "0"}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Browse Raffles Card */}
        <div className="ui-container flex flex-col overflow-hidden rounded-2xl">
          <div className="flex flex-1 flex-col p-6 lg:p-8">
            <div className="mb-4 flex items-center gap-3 lg:mb-6 lg:gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-accent-warm/15 lg:h-14 lg:w-14">
                <span className="material-symbols-outlined text-accent-warm" style={{ fontSize: 28 }}>confirmation_number</span>
              </div>
              <div>
                <h3 className="text-xl font-header text-text-primary lg:text-2xl">Browse Raffles</h3>
                <p className="text-xs text-muted-blue lg:text-sm">Explore active and upcoming raffles</p>
              </div>
            </div>
            <p className="mb-4 flex-1 text-xs leading-relaxed text-muted-blue lg:mb-6 lg:text-sm">
              Find exciting raffles with prizes ranging from ERC20 token pools to rare NFTs and composable ERC6220 collections — plus raffles created by the community.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/raffles" className="flex-1">
                <button className="flex h-12 w-full items-center justify-center rounded-xl bg-accent-warm text-xs font-bold uppercase tracking-[0.15em] text-background transition-all hover:brightness-110 active:scale-[0.99] lg:text-sm">
                  View Raffles
                </button>
              </Link>
              <Link href="/community-raffles" className="flex-1">
                <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-black/5 text-xs font-bold uppercase tracking-[0.15em] text-text-primary transition-all hover:bg-black/10 lg:text-sm">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>groups</span>
                  Community
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Game Card */}
        <div className="ui-container flex flex-col overflow-hidden rounded-2xl">
          <div className="flex flex-1 flex-col p-6 lg:p-8">
            <div className="mb-4 flex items-center gap-3 lg:mb-6 lg:gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-accent-warm/15 lg:h-14 lg:w-14">
                <span className="material-symbols-outlined text-accent-warm" style={{ fontSize: 28 }}>sports_esports</span>
              </div>
              <div>
                <h3 className="text-xl font-header text-text-primary lg:text-2xl">Play the Game</h3>
                <p className="text-xs text-muted-blue lg:text-sm">Jump in and start earning</p>
              </div>
            </div>
            <p className="mb-4 flex-1 text-xs leading-relaxed text-muted-blue lg:mb-6 lg:text-sm">
              Play to earn tokens, climb the leaderboard, and use your rewards to enter raffles.
            </p>
            <Link href="/game">
              <button className="flex h-12 w-full items-center justify-center rounded-xl bg-accent-warm text-xs font-bold uppercase tracking-[0.15em] text-background transition-all hover:brightness-110 active:scale-[0.99] lg:text-sm">
                Play Game
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="ui-container rounded-2xl p-6 lg:p-8">
        <h3 className="mb-6 text-xl font-header text-text-primary lg:mb-8 lg:text-2xl">How It Works</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {STEPS.map((step) => (
            <div key={step.n} className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-warm/15 font-display text-lg font-bold text-accent-warm">
                {step.n}
              </div>
              <h4 className="mb-2 text-sm font-bold text-text-primary lg:text-base">{step.title}</h4>
              <p className="text-xs text-muted-blue lg:text-sm">{step.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className={`ui-container rounded-2xl p-5 lg:p-6 ${"wide" in f && f.wide ? "sm:col-span-2 lg:col-span-1" : ""}`}
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-warm/15 text-accent-warm">
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{f.icon}</span>
            </div>
            <h4 className="mb-2 text-sm font-bold text-text-primary lg:text-base">{f.title}</h4>
            <p className="text-xs text-muted-blue lg:text-sm">{f.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
