"use client";

import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { useTokenBalance, formatTokenBalance } from "@/lib/hooks";

export function Header() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { data: balance } = useTokenBalance(address);

  // Determine page title based on path
  const getPageTitle = () => {
    if (pathname === "/") return "Profile Overview";
    if (pathname.startsWith("/faucet")) return "Faucet";
    if (pathname.startsWith("/claim")) return "Claim";
    if (pathname.startsWith("/community-raffles")) return "Community Raffles";
    if (pathname.startsWith("/raffles")) return "Raffles";
    if (pathname.startsWith("/game")) return "ARIWA: Last Stand";
    if (pathname.startsWith("/leaderboard")) return "Leaderboard";
    if (pathname.startsWith("/admin")) return "Admin Dashboard";
    return "Ariwa";
  };

  return (
    <header className="sticky top-0 z-10 bg-dark-navy/80 backdrop-blur-md border-b border-black/10 px-4 lg:px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3 lg:gap-6 flex-1 min-w-0">
        {/* Mobile: Leave space for menu button */}
        <div className="lg:hidden w-10"></div>
        <img src="/ariwa-logo.png" alt="Ariwa" className="h-9 w-auto object-contain shrink-0" />
        <h1 className="text-lg lg:text-2xl font-header text-text-primary truncate">{getPageTitle()}</h1>
        <div className="hidden xl:flex gap-4">
          <a
            className="text-sm text-muted-blue hover:text-[#0062df] transition-colors"
            href="https://sepolia-explorer.giwa.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Explorer
          </a>
          <a
            className="text-muted-blue hover:text-[#0062df] transition-colors flex items-center"
            href="https://x.com/ARIWA_on_Giwa"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="ARIWA on X"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 fill-current">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        {isConnected && balance !== undefined && (
          <div className="px-2 lg:px-4 py-2 bg-[#0062df]/30 border border-[#0062df]/20 rounded-full flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#0062df] animate-pulse"></div>
            <span className="text-[10px] lg:text-xs font-bold uppercase tracking-widest text-text-primary">
              <span className="hidden sm:inline">{formatTokenBalance(balance)} </span>
              <span className="sm:hidden">{formatTokenBalance(balance)} </span>
              ARIWA
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
