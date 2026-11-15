"use client";

import { useState } from "react";
import Image from "next/image";
import { useSwitchChain } from "wagmi";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Check,
  Copy,
  Droplets,
  Loader2,
  Plus,
  Sparkles,
  Wallet,
} from "lucide-react";
import { giwaSepolia } from "@/lib/contracts";
import { NFT_PIECES } from "@/lib/art";

const EXPLORER_URL =
  giwaSepolia.blockExplorers?.default.url || "https://sepolia-explorer.giwa.io";
const RPC_HTTP = giwaSepolia.rpcUrls.default.http[0] || "https://sepolia-rpc.giwa.io";

const FAUCETS = [
  {
    name: "GIWA Faucet",
    href: "https://faucet.giwa.io",
    drip: "0.005 ETH",
    cooldown: "24h",
    note: "The official GIWA testnet faucet. A small, dependable drip.",
    tone: "butter",
    art: 1,
  },
  {
    name: "Nodit Faucet",
    href: "https://faucet.lambda256.io/giwa-sepolia",
    drip: "0.01 ETH",
    cooldown: "24h",
    note: "Run by Lambda256 / Nodit. Twice the drip when the first one runs dry.",
    tone: "mint",
    art: 314,
  },
] as const;

const DETAIL_ROWS = [
  { label: "Native token", value: giwaSepolia.nativeCurrency.symbol },
  { label: "Rollup stack", value: "OP Stack" },
  { label: "Settlement", value: "Ethereum Sepolia" },
  { label: "Data availability", value: "Ethereum" },
] as const;

const TONE_STYLES: Record<string, string> = {
  butter: "tone-panel-butter tone-border-butter",
  mint: "tone-panel-mint tone-border-mint",
};

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">
        {label}
      </span>
      <button
        onClick={copy}
        className="group flex items-center gap-2 text-left text-[12px] font-medium text-ink transition-colors hover:text-iris"
        title="Click to copy"
      >
        <span className="truncate">{value}</span>
        {copied ? (
          <Check className="size-3.5 shrink-0 text-success" />
        ) : (
          <Copy className="size-3.5 shrink-0 text-ink-faint group-hover:text-iris" />
        )}
      </button>
    </div>
  );
}

export default function FaucetPage() {
  const { switchChain, isPending } = useSwitchChain();

  const addNetwork = () => {
    switchChain(
      { chainId: giwaSepolia.id },
      {
        onSuccess: () => toast.success("GIWA Sepolia is now selected in your wallet."),
        onError: (err) => {
          const msg = (err as { shortMessage?: string }).shortMessage ?? err.message ?? "";
          if (/rejected|denied/i.test(msg)) return;
          toast.error("Could not add the network. Add it manually with the details below.");
        },
      },
    );
  };

  return (
    <div className="page-shell">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">The well</p>
          <h1 className="display mt-4 text-[clamp(2.2rem,5vw,3.6rem)] text-ink">
            A drop of gas
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-6 text-ink-soft">
            Grab free {giwaSepolia.nativeCurrency.symbol} on {giwaSepolia.name} to
            move around the Hollow. Claim from an official faucet, then add the
            network to your wallet.
          </p>
        </div>
        <span className="hidden items-center gap-2 rounded-full border border-ink/10 bg-paper/60 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft sm:inline-flex">
          <span className="live-dot" />
          testnet only
        </span>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FAUCETS.map((faucet) => {
          const piece = NFT_PIECES.find((item) => item.id === faucet.art) ?? NFT_PIECES[0];
          return (
            <a
              key={faucet.name}
              href={faucet.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`group relative overflow-hidden rounded-[26px] border p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_-38px_rgba(39,33,50,0.55)] sm:p-7 ${TONE_STYLES[faucet.tone]}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 items-center justify-center rounded-xl border border-ink/10 bg-white/55 text-ink-soft dark:border-white/10 dark:bg-white/[0.06]">
                      <Droplets className="size-4" />
                    </span>
                    <h2 className="font-header text-xl font-extrabold tracking-[-0.03em] text-ink">
                      {faucet.name}
                    </h2>
                  </div>
                  <div className="mt-4 flex items-center gap-2.5">
                    <span className="rounded-full border border-ink/10 bg-white/55 px-3 py-1 font-mono text-[11px] font-semibold text-ink dark:border-white/10 dark:bg-white/[0.06]">
                      {faucet.drip}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">
                      every {faucet.cooldown}
                    </span>
                  </div>
                  <p className="mt-3 max-w-[250px] text-[11.5px] leading-5 text-ink-soft">
                    {faucet.note}
                  </p>
                </div>
                <span className="relative size-20 shrink-0 overflow-hidden rounded-full border-4 border-white/60 shadow-[0_16px_30px_-18px_rgba(39,33,50,0.5)] sm:size-24 dark:border-white/15">
                  <Image src={piece.src} alt="" fill sizes="96px" className="object-cover" />
                </span>
              </div>

              <div className="mt-6 inline-flex items-center gap-1.5 border-t border-ink/10 pt-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink">
                Open faucet
                <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </a>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative overflow-hidden rounded-[26px] border border-[#2b2438] bg-[#1d1826] p-6 sm:p-7 dark:border-white/15">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-iris/20 blur-3xl"
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-iris-soft">
                One click
              </p>
              <h2 className="mt-2 font-header text-xl font-extrabold tracking-[-0.03em] text-white">
                Add GIWA Sepolia
              </h2>
              <p className="mt-2 max-w-sm text-[11.5px] leading-5 text-white/55">
                Add or switch the network from here, or copy the details into
                your wallet manually.
              </p>
            </div>
            <button
              onClick={addNetwork}
              disabled={isPending}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#f7e3a0] px-5 text-[11px] font-bold text-[#272132] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Plus className="size-4" />
                  Add network
                </>
              )}
            </button>
          </div>
        </div>

        <div className="ui-container rounded-[26px] p-6 sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-header text-lg font-extrabold tracking-[-0.03em] text-ink">
              Network details
            </h2>
            <span className="rounded-full bg-iris/[0.08] px-3 py-1 font-mono text-[10px] font-semibold text-iris-deep">
              {giwaSepolia.id}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            {DETAIL_ROWS.map((row) => (
              <div key={row.label}>
                <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-ink-mute">
                  {row.label}
                </p>
                <p className="mt-1.5 text-[12px] font-semibold text-ink">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ui-container mt-4 overflow-hidden rounded-[26px]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/[0.08] px-6 py-4">
          <h2 className="font-header text-lg font-extrabold tracking-[-0.03em] text-ink">
            Copy the details
          </h2>
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">
            <Wallet className="size-3.5" /> manual setup
          </span>
        </div>
        <div className="grid grid-cols-1 gap-6 px-6 py-6 sm:grid-cols-2 lg:grid-cols-3">
          <CopyRow label="Network name" value={giwaSepolia.name} />
          <CopyRow label="RPC (HTTP)" value={RPC_HTTP} />
          <CopyRow label="Block explorer" value={EXPLORER_URL} />
        </div>
      </div>

      <p className="mt-5 flex items-start gap-2 text-[11px] leading-5 text-ink-mute">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-iris" />
        <span>
          Need more? {giwaSepolia.name} settles to Ethereum Sepolia — get Sepolia
          ETH from a public faucet and bridge it via{" "}
          <a
            href="https://docs.giwa.io/get-started/bridging"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-iris hover:underline"
          >
            the GIWA bridge
          </a>
          .
        </span>
      </p>
    </div>
  );
}
