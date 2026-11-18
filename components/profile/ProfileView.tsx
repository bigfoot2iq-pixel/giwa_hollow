"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance, useSwitchChain } from "wagmi";
import { formatUnits } from "viem";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Loader2,
  Wallet,
} from "lucide-react";
import { ARIWA_PIECES } from "@/lib/art";
import { contracts, giwaSepolia } from "@/lib/contracts";
import { useTokenBalance } from "@/lib/hooks";
import { cn } from "@/lib/utils/cn";
import { formatCompactNumber } from "@/lib/utils/format";
import { TokenMark } from "@/components/trade/token-marks";
import { AriwaNfts } from "./AriwaNfts";
import { WalletAvatar } from "./WalletAvatar";

const EXPLORER_URL =
  giwaSepolia.blockExplorers?.default.url || "https://sepolia-explorer.giwa.io";

const HERO_PIECE = ARIWA_PIECES[0];

function shortAddress(address: string, size = 5): string {
  return `${address.slice(0, 2 + size)}…${address.slice(-size)}`;
}

function formatBalance(
  value: bigint | undefined,
  maximumFractionDigits: number,
): { display: string; full: string } {
  if (value === undefined) return { display: "—", full: "" };

  const raw = formatUnits(value, 18);
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return { display: raw, full: raw };

  const full = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 18,
  }).format(numeric);

  const display = formatCompactNumber(numeric, {
    compactFrom: 1_000_000,
    maximumFractionDigits,
    fallback: "—",
  });

  // A tiny testnet balance is still a balance; never round a live position to 0.
  if (numeric > 0 && Number(display.replace(/,/g, "")) === 0) {
    const smallest = (10 ** -maximumFractionDigits).toFixed(
      maximumFractionDigits,
    );
    return { display: `<${smallest}`, full };
  }

  return { display, full };
}

function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Wallet address copied.");
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      toast.error("Could not copy the address.");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label="Copy wallet address"
      title="Copy wallet address"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-paper/70 text-ink-mute transition hover:border-iris/30 hover:text-iris"
    >
      {copied ? (
        <Check className="size-3.5 text-success" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}

function IdentityCard({ address }: { address: string }) {
  return (
    <section className="ui-container relative flex h-full flex-col overflow-hidden rounded-[28px] p-6 sm:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-iris/[0.11] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-16 size-44 rounded-full bg-blush/30 blur-3xl"
      />

      <div className="relative flex items-start justify-between gap-3">
        <span className="pill">
          <span className="live-dot" />
          connected
        </span>
        <CopyAddressButton address={address} />
      </div>

      <div className="relative mt-6 flex items-center gap-4">
        <WalletAvatar address={address} className="size-16" />
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-mute">
            ARIWA resident
          </p>
          <h2
            title={address}
            className="mt-1 truncate font-header text-[1.35rem] font-extrabold tracking-[-0.035em] text-ink"
          >
            {shortAddress(address)}
          </h2>
          <p className="mt-1 font-mono text-[10px] text-ink-mute">
            {giwaSepolia.name}
          </p>
        </div>
      </div>

      <div className="relative mt-auto pt-7">
        <a
          href={`${EXPLORER_URL}/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-ink/[0.08] bg-paper/60 px-4 py-3 text-[11px] font-medium text-ink-soft transition hover:border-iris/30 hover:bg-paper hover:text-ink"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-iris/[0.1] text-iris">
              <Wallet className="size-3.5" />
            </span>
            <span className="truncate">View on the GIWA explorer</span>
          </span>
          <ArrowUpRight className="size-3.5 shrink-0 text-ink-mute transition group-hover:text-iris" />
        </a>
      </div>
    </section>
  );
}

const BALANCE_TONES = {
  sky: {
    panel: "bg-sky/35",
    glow: "bg-sky/55",
    action: "text-sky-ink",
  },
  lilac: {
    panel: "bg-lilac/35",
    glow: "bg-lilac/55",
    action: "text-lilac-ink",
  },
} as const;

function BalanceCard({
  label,
  sublabel,
  symbol,
  tone,
  value,
  fullValue,
  isLoading,
  isError,
  onRetry,
  actionLabel,
  actionHref,
  explorerHref,
}: {
  label: string;
  sublabel: string;
  symbol: "ETH" | "ARIWA";
  tone: keyof typeof BALANCE_TONES;
  value: string;
  fullValue: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  actionLabel: string;
  actionHref: string;
  explorerHref: string;
}) {
  const palette = BALANCE_TONES[tone];

  return (
    <section
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-[28px] border border-ink/[0.08] p-6 sm:p-7",
        palette.panel,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-14 -top-16 size-48 rounded-full blur-3xl",
          palette.glow,
        )}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
            {label}
          </p>
          <p className="mt-1.5 max-w-[170px] text-[10.5px] leading-5 text-ink-mute">
            {sublabel}
          </p>
        </div>
        <TokenMark symbol={symbol} className="size-10" />
      </div>

      <div className="relative mt-7 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {isLoading ? (
          <span
            aria-hidden="true"
            className="inline-block h-10 w-32 animate-pulse rounded-xl bg-ink/10"
          />
        ) : (
          <span
            title={fullValue || undefined}
            className="font-header text-[clamp(2rem,3.4vw,2.65rem)] font-extrabold leading-none tracking-[-0.05em] text-ink tabular-nums"
          >
            {isError ? "—" : value}
          </span>
        )}
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
          {symbol}
        </span>
      </div>

      {isError ? (
        <p className="relative mt-3 text-[10.5px] text-danger-ink">
          Could not read the balance.{" "}
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold underline underline-offset-2 transition hover:text-danger"
          >
            Retry
          </button>
        </p>
      ) : (
        <p className="relative mt-3 text-[10px] text-ink-mute">
          Balance updates automatically.
        </p>
      )}

      <div className="relative mt-auto pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
          <a
            href={explorerHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute transition hover:text-ink"
          >
            Explorer
            <ArrowUpRight className="size-3" />
          </a>
          <Link
            href={actionHref}
            className={cn(
              "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition hover:opacity-80",
              palette.action,
            )}
          >
            {actionLabel}
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function NetworkNotice({ chainName }: { chainName?: string }) {
  const { switchChain, isPending } = useSwitchChain();

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/[0.08] px-4 py-3"
    >
      <p className="flex items-center gap-2 text-[11.5px] leading-5 text-warning-ink">
        <AlertTriangle className="size-4 shrink-0" />
        Your wallet is on {chainName || "another network"}. Switch to{" "}
        {giwaSepolia.name} to transact with your ARIWA.
      </p>
      <button
        type="button"
        onClick={() =>
          switchChain(
            { chainId: giwaSepolia.id },
            {
              onError: (error) => {
                const message =
                  (error as { shortMessage?: string }).shortMessage ??
                  error.message ??
                  "";
                if (/rejected|denied/i.test(message)) return;
                toast.error("Could not switch networks. Change it in your wallet.");
              },
            },
          )
        }
        disabled={isPending}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-warning/35 bg-warning/10 px-4 text-[10.5px] font-semibold text-warning-ink transition hover:bg-warning/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Wallet className="size-3.5" />
        )}
        Switch network
      </button>
    </div>
  );
}

function ConnectedProfile({
  address,
  chainName,
  wrongNetwork,
}: {
  address: `0x${string}`;
  chainName?: string;
  wrongNetwork: boolean;
}) {
  const {
    data: ethBalance,
    isLoading: isEthLoading,
    isError: isEthError,
    refetch: refetchEth,
  } = useBalance({
    address,
    chainId: giwaSepolia.id,
    query: {
      enabled: true,
      refetchInterval: 20_000,
      refetchOnWindowFocus: true,
    },
  });

  const {
    data: ariwaBalance,
    isLoading: isAriwaLoading,
    isError: isAriwaError,
    refetch: refetchAriwa,
  } = useTokenBalance(address, { refetchInterval: 20_000 });

  const eth = formatBalance(ethBalance?.value, 6);
  const ariwa = formatBalance(ariwaBalance as bigint | undefined, 4);
  const walletExplorerHref = `${EXPLORER_URL}/address/${address}`;

  return (
    <div className="mt-8">
      {wrongNetwork && (
        <div className="mb-4">
          <NetworkNotice chainName={chainName} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[1.08fr_0.96fr_0.96fr]">
        <div className="md:col-span-2 lg:col-span-1">
          <IdentityCard address={address} />
        </div>

        <BalanceCard
          label="Sepolia ETH"
          sublabel="Native gas on GIWA Sepolia"
          symbol="ETH"
          tone="sky"
          value={eth.display}
          fullValue={eth.full}
          isLoading={isEthLoading}
          isError={isEthError}
          onRetry={() => void refetchEth()}
          actionLabel="Get gas"
          actionHref="/faucet"
          explorerHref={walletExplorerHref}
        />

        <BalanceCard
          label="ARIWA"
          sublabel="ERC-20 on GIWA Sepolia"
          symbol="ARIWA"
          tone="lilac"
          value={ariwa.display}
          fullValue={ariwa.full}
          isLoading={isAriwaLoading}
          isError={isAriwaError}
          onRetry={() => void refetchAriwa()}
          actionLabel="Trade"
          actionHref="/trade"
          explorerHref={
            contracts.ariwaToken.address
              ? `${EXPLORER_URL}/token/${contracts.ariwaToken.address}`
              : walletExplorerHref
          }
        />
      </div>

      <AriwaNfts address={address} />
    </div>
  );
}

function ConnectPanel() {
  return (
    <section className="ui-container relative mt-8 overflow-hidden rounded-[30px] px-6 py-8 sm:px-10 sm:py-11">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-28 size-72 rounded-full bg-iris/[0.09] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 right-0 size-72 rounded-full bg-blush/25 blur-3xl"
      />

      <div className="relative flex flex-col items-start gap-9 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
        <div className="max-w-lg">
          <p className="eyebrow">Your wallet</p>
          <h2 className="display mt-4 text-[clamp(1.9rem,4vw,2.9rem)] text-ink">
            Meet your <span className="text-gradient">ARIWA</span> corner.
          </h2>
          <p className="mt-3.5 max-w-md text-[13px] leading-7 text-ink-soft">
            Connect a wallet to see your Sepolia ETH, your ARIWA balance, and
            every resident you hold on GIWA Sepolia — gathered in one quiet place.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <ConnectButton.Custom>
              {({ openConnectModal, mounted }) => (
                <button
                  type="button"
                  onClick={openConnectModal}
                  disabled={!mounted}
                  className="btn-iris h-12 px-6 text-[13px]"
                >
                  <Wallet className="size-4" />
                  Connect wallet
                </button>
              )}
            </ConnectButton.Custom>

            <Link href="/launchpad" className="btn-soft h-12 px-5 text-[12px]">
              Explore the collection
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <p className="mt-5 text-[10.5px] leading-5 text-ink-mute">
            Read-only. Your wallet is never asked to sign anything.
          </p>
        </div>

        <div className="relative mx-auto shrink-0 pr-4 sm:mx-0 sm:pr-6">
          <div
            aria-hidden="true"
            className="absolute inset-0 scale-110 rounded-full bg-iris/15 blur-2xl"
          />
          <span className="relative block size-40 overflow-hidden rounded-full border-4 border-white/70 shadow-[0_26px_50px_-28px_rgba(39,33,50,0.6)] sm:size-52 dark:border-white/15">
            <Image
              src={HERO_PIECE.src}
              alt=""
              fill
              sizes="(max-width: 640px) 160px, 208px"
              loading="eager"
              className="object-cover"
            />
          </span>
          <span
            aria-hidden="true"
            className="pill absolute -left-5 top-6 bg-paper/90 shadow-[0_10px_24px_-18px_rgba(39,33,50,0.6)]"
          >
            <span className="size-1.5 rounded-full bg-[#627EEA]" />
            ETH
          </span>
          <span
            aria-hidden="true"
            className="pill absolute -right-1 bottom-7 bg-paper/90 shadow-[0_10px_24px_-18px_rgba(39,33,50,0.6)]"
          >
            <span className="iris-dot" />
            ARIWA
          </span>
          <span
            aria-hidden="true"
            className="pill absolute -bottom-2 left-7 bg-paper/90 shadow-[0_10px_24px_-18px_rgba(39,33,50,0.6)]"
          >
            NFTs
          </span>
        </div>
      </div>
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div
      className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-[1.08fr_0.96fr_0.96fr]"
      aria-busy="true"
      aria-label="Loading your profile"
    >
      <div className="ui-container h-56 animate-pulse rounded-[28px] md:col-span-2 lg:col-span-1" />
      <div className="h-56 animate-pulse rounded-[28px] border border-ink/[0.08] bg-sky/25" />
      <div className="h-56 animate-pulse rounded-[28px] border border-ink/[0.08] bg-lilac/30" />
    </div>
  );
}

export function ProfileView() {
  const { address, status, chain } = useAccount();
  const connected = status === "connected" && Boolean(address);
  const settling = status === "connecting" || status === "reconnecting";
  const wrongNetwork = connected && Boolean(chain && chain.id !== giwaSepolia.id);

  return (
    <div className="page-shell">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Your corner</p>
          <h1 className="display mt-4 text-[clamp(2.2rem,5vw,3.6rem)] text-ink">
            Your ARIWA <span className="text-gradient">profile</span>
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-6 text-ink-soft">
            Your Sepolia ETH, your ARIWA balance, and every resident you hold —
            all in one place.
          </p>
        </div>

        <span className="hidden items-center gap-2 rounded-full border border-ink/10 bg-paper/60 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft sm:inline-flex">
          <span className="live-dot" />
          {giwaSepolia.name}
        </span>
      </header>

      {settling ? (
        <ProfileSkeleton />
      ) : connected && address ? (
        <ConnectedProfile
          address={address}
          chainName={chain?.name}
          wrongNetwork={wrongNetwork}
        />
      ) : (
        <ConnectPanel />
      )}
    </div>
  );
}
