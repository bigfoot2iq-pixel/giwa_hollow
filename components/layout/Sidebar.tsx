"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAdminStatus } from "@/lib/hooks";
import { useState } from "react";

const navItems = [
  { href: "/faucet", label: "Faucet", icon: "water_drop" },
  { href: "/trade", label: "Trade ARIWA", icon: "swap_horiz" },
  { href: "/launchpad", label: "Launchpad", icon: "rocket_launch" },
  { href: "/raffles", label: "Raffles", icon: "confirmation_number" },
  { href: "/leaderboard", label: "Leaderboard", icon: "emoji_events" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { isAdmin } = useAdminStatus(isConnected ? address : undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-dark-navy/95 border border-ink/10 rounded text-text-primary shadow-sm"
      >
        <span className="material-symbols-outlined">
          {mobileMenuOpen ? "close" : "menu"}
        </span>
      </button>

      {/* Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-64 flex-shrink-0 border-r border-ink/10 bg-dark-navy/95 flex flex-col justify-between p-6
        lg:relative lg:translate-x-0
        fixed inset-y-0 left-0 z-40 transition-transform duration-300
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
      <div className="flex flex-col gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/brand/ariwa-icon.webp"
            alt="Ariwa"
            className="h-10 w-10 shrink-0 rounded-xl object-cover"
          />
          <span className="min-w-0">
            <span className="block font-display text-lg font-bold tracking-tight text-text-primary">
              ARIWA
            </span>
            <span className="block text-[9px] font-bold uppercase tracking-[0.22em] text-iris">
              The Hollow
            </span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded transition-all cursor-pointer ${
                  isActive
                    ? "bg-iris-strong text-white"
                    : "text-muted-blue hover:bg-ink/[0.04] hover:text-text-primary"
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <p className={`text-sm ${isActive ? "font-bold uppercase tracking-wider" : "font-medium"}`}>
                  {item.label}
                </p>
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded transition-all cursor-pointer ${
                pathname.startsWith("/admin")
                  ? "bg-iris-strong text-white"
                  : "text-muted-blue hover:bg-ink/[0.06] hover:text-text-primary"
              }`}
            >
              <span className="material-symbols-outlined">admin_panel_settings</span>
              <p className={`text-sm ${pathname.startsWith("/admin") ? "font-bold uppercase tracking-wider" : "font-medium"}`}>
                Admin
              </p>
            </Link>
          )}
        </nav>
      </div>

      {/* User section with RainbowKit */}
      <div className="flex flex-col gap-4">
        <a
          href="https://x.com/ARIWA_on_Giwa"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 rounded text-muted-blue hover:bg-ink/[0.04] hover:text-text-primary transition-all"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <p className="text-sm font-medium">Follow on X</p>
        </a>
        <ConnectButton.Custom>
          {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
            const ready = mounted;
            const connected = ready && account && chain;

            if (!ready) return null;

            if (!connected) {
              return (
                <button
                  onClick={openConnectModal}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-iris-strong hover:brightness-110 text-white text-sm font-bold rounded transition-all uppercase tracking-widest"
                >
                  <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                  Connect Wallet
                </button>
              );
            }

            if (chain.unsupported) {
              return (
                <button
                  onClick={openChainModal}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-red-500 hover:bg-red-600 text-text-primary text-sm font-bold rounded transition-all uppercase tracking-widest"
                >
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Wrong Network
                </button>
              );
            }

            return (
              <button
                onClick={openAccountModal}
                className="flex items-center gap-3 p-3 bg-paper rounded border border-ink/10 hover:bg-ink/[0.04] transition-colors cursor-pointer w-full"
              >
                <div className="h-10 w-10 rounded bg-iris-strong flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  G
                </div>
                <div className="flex flex-col overflow-hidden flex-1 text-left">
                  <p className="text-sm font-bold text-text-primary truncate">
                    {account.displayName}
                  </p>
                  <p className="text-xs text-muted-blue truncate">
                    {account.displayBalance || chain.name}
                  </p>
                </div>
              </button>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </aside>
    </>
  );
}
