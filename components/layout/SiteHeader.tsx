"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AlertTriangle, ChevronDown, Menu, Wallet, X } from "lucide-react";
import { useAccount } from "wagmi";
import { useAdminStatus, useTokenBalance, formatCompactBalance } from "@/lib/hooks";
import { cn } from "@/lib/utils/cn";
import { XAccountLink } from "./XAccountLink";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { label: "Home", href: "/home" },
  { label: "Trade", href: "/trade" },
  { label: "Launchpad", href: "/launchpad" },
  { label: "Create", href: "/create" },
  { label: "Faucet", href: "/faucet" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Raffles", href: "/raffles" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const { address } = useAccount();
  const { data: balance } = useTokenBalance(address);
  const { isAdmin } = useAdminStatus(address);
  // Derive "open" from the current pathname so navigating (including browser
  // back/forward) closes the mobile menu without a setState-in-effect.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const navItems: { label: string; href: string }[] = isAdmin
    ? [...NAV, { label: "Admin", href: "/admin" }]
    : [...NAV];

  // "/" now serves the launchpad, so keep the Launchpad item highlighted there.
  const isActive = (href: string) => {
    if (href === "/launchpad" && pathname === "/") return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-ink/[0.08] bg-cream/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] w-full max-w-[1320px] items-center justify-between gap-3 px-5 sm:px-8">
        <Link href="/home" className="group flex items-center gap-3" aria-label="ARIWA home">
          <span className="relative inline-flex size-10 shrink-0 overflow-hidden rounded-full border border-ink/10 bg-butter shadow-[0_8px_20px_-12px_rgba(39,33,50,0.6)] transition-transform duration-300 group-hover:-rotate-3">
            <Image
              src="/brand/ariwa-icon.webp"
              alt=""
              width={80}
              height={80}
              preload
              className="size-full object-cover"
            />
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-cream bg-success" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-header text-[15px] font-extrabold tracking-[0.18em] text-ink">
              ARIWA
            </span>
            <span className="mt-1 font-mono text-[8px] uppercase tracking-[0.26em] text-iris">
              the hollow
            </span>
          </span>
        </Link>

        <nav
          aria-label="Main"
          className="hidden items-center gap-0.5 rounded-full border border-ink/[0.08] bg-paper/55 p-1 backdrop-blur-md lg:flex"
        >
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-2 py-2 text-[11px] font-medium transition-colors xl:px-3 xl:text-[12.5px]",
                  active
                    ? "bg-ink text-cream shadow-[0_6px_14px_-8px_rgba(39,33,50,0.7)]"
                    : "text-ink-soft hover:bg-ink/[0.05] hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {address && balance !== undefined && (
            <span className="hidden items-center gap-1.5 rounded-full border border-iris/15 bg-iris/[0.06] px-3 py-1.5 font-mono text-[10px] tracking-[0.04em] text-iris-deep xl:inline-flex">
              <span className="iris-dot size-1.5" />
              {formatCompactBalance(balance)} ARIWA
            </span>
          )}

          <XAccountLink className="hidden sm:inline-flex" />

          <ThemeToggle />

          <div className="hidden sm:block">
            <WalletButton />
          </div>

          <button
            type="button"
            onClick={() => setOpenPath(open ? null : pathname)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex size-10 items-center justify-center rounded-full border border-ink/10 bg-paper/60 text-ink transition hover:bg-paper lg:hidden"
          >
            {open ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-ink/[0.06] bg-cream/95 backdrop-blur-xl transition-[max-height,opacity] duration-300 lg:hidden",
          open ? "max-h-[38rem] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="mx-auto w-full max-w-[1320px] px-5 py-4 sm:px-8">
          <nav className="grid grid-cols-2 gap-1.5" aria-label="Mobile">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpenPath(null)}
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm font-medium transition",
                    active
                      ? "bg-ink text-cream"
                      : "bg-paper/60 text-ink-soft hover:bg-paper hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-ink/[0.08] bg-paper/60 px-4 py-3">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-mute">
                Your nook
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                {address ? formatCompactBalance(balance) + " ARIWA" : "Connect to step inside"}
              </p>
            </div>
            <WalletButton compact />
          </div>
        </div>
      </div>
    </header>
  );
}

function WalletButton({ compact = false }: { compact?: boolean }) {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
            })}
            className={cn("flex items-center gap-2", compact && "w-auto")}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className={cn("btn-ink h-10 px-4 text-xs", compact && "h-9 px-3.5")}
                  >
                    <Wallet className="size-3.5" />
                    Connect
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    type="button"
                    onClick={openChainModal}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-warning/35 bg-warning/10 px-4 text-xs font-semibold text-warning-ink transition hover:bg-warning/15"
                  >
                    <AlertTriangle className="size-3.5" />
                    Switch network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={openChainModal}
                    className="hidden h-10 items-center gap-1.5 rounded-full border border-ink/10 bg-paper/60 px-3 text-[11px] font-medium text-ink-soft transition hover:border-ink/20 hover:text-ink xl:inline-flex"
                  >
                    <span className="size-1.5 rounded-full bg-success" />
                    {chain.name}
                  </button>
                  <button
                    type="button"
                    onClick={openAccountModal}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-ink/10 bg-paper/70 pl-1.5 pr-2.5 text-xs font-medium text-ink transition hover:border-iris/30 hover:bg-paper"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-[linear-gradient(140deg,#b9acf5,#6c55e0)] text-[10px] font-bold text-white">
                      {account.displayName.slice(0, 2)}
                    </span>
                    <span className="font-mono text-[11px]">{account.displayName}</span>
                    <ChevronDown className="size-3 text-ink-mute" />
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
