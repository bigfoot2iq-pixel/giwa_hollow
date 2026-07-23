"use client";

import { useState } from "react";
import { useSwitchChain } from "wagmi";
import { toast } from "sonner";
import { giwaSepolia } from "@/lib/contracts";

const EXPLORER_URL = giwaSepolia.blockExplorers?.default.url || "https://sepolia-explorer.giwa.io";
const RPC_HTTP = giwaSepolia.rpcUrls.default.http[0] || "https://sepolia-rpc.giwa.io";

// Official testnet faucets for GIWA Sepolia (see https://docs.giwa.io/get-started/faucets).
const FAUCETS = [
  {
    name: "GIWA Faucet",
    href: "https://faucet.giwa.io",
    drip: "0.005 ETH",
    cooldown: "24h",
    note: "Official GIWA testnet faucet.",
    icon: "water_drop",
  },
  {
    name: "Nodit Faucet",
    href: "https://faucet.lambda256.io/giwa-sepolia",
    drip: "0.01 ETH",
    cooldown: "24h",
    note: "Run by Lambda256 / Nodit — larger drip.",
    icon: "opacity",
  },
] as const;

const DETAIL_ROWS = [
  { label: "Native Token", icon: "toll", value: giwaSepolia.nativeCurrency.symbol },
  { label: "Rollup Stack", icon: "view_in_ar", value: "OP Stack" },
  { label: "Settlement Layer", icon: "layers", value: "Ethereum Sepolia" },
  { label: "Data Availability", icon: "cloud_queue", value: "Ethereum" },
] as const;

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
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">{label}</span>
      <button
        onClick={copy}
        className="group flex items-center gap-2 text-left text-sm font-display text-text-primary transition-colors hover:text-accent-warm"
        title="Click to copy"
      >
        <span className="truncate">{value}</span>
        <span className="material-symbols-outlined text-muted-blue group-hover:text-accent-warm" style={{ fontSize: 16 }}>
          {copied ? "check" : "content_copy"}
        </span>
      </button>
    </div>
  );
}

export default function FaucetPage() {
  const { switchChain, isPending } = useSwitchChain();

  const addNetwork = () => {
    // wagmi/viem switches to GIWA Sepolia, prompting the wallet to add it if missing.
    switchChain(
      { chainId: giwaSepolia.id },
      {
        onSuccess: () => toast.success("GIWA Sepolia is now selected in your wallet."),
        onError: (err) => {
          const msg = (err as { shortMessage?: string }).shortMessage ?? err.message ?? "";
          if (/rejected|denied/i.test(msg)) return; // user dismissed — no toast
          toast.error("Could not add the network. Add it manually with the details below.");
        },
      }
    );
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Page heading */}
      <div className="space-y-2">
        <h1 className="text-3xl font-header text-text-primary sm:text-4xl lg:text-5xl">Faucet</h1>
        <p className="max-w-2xl text-sm text-muted-blue sm:text-base">
          Grab free {giwaSepolia.nativeCurrency.symbol} on {giwaSepolia.name} for gas. Claim from an
          official faucet below, then add the network to your wallet to start testing.
        </p>
      </div>

      {/* Faucet options */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
        {FAUCETS.map((f) => (
          <a
            key={f.name}
            href={f.href}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-container group flex flex-col gap-4 rounded-2xl p-6 transition-all hover:border-accent-warm/40 sm:p-8"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-warm/15">
                <span className="material-symbols-outlined text-accent-warm" style={{ fontSize: 24 }}>
                  {f.icon}
                </span>
              </div>
              <h2 className="text-xl font-header text-text-primary">{f.name}</h2>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-md bg-accent-warm/15 px-2.5 py-1 font-display text-sm font-bold text-accent-warm">
                {f.drip}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-blue">
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>schedule</span>
                every {f.cooldown}
              </span>
            </div>

            <p className="text-xs text-muted-blue">{f.note}</p>

            <div className="mt-auto flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] text-accent-warm">
              Open Faucet
              <span className="material-symbols-outlined transition-transform group-hover:translate-x-0.5" style={{ fontSize: 18 }}>
                open_in_new
              </span>
            </div>
          </a>
        ))}
      </div>

      {/* Add network */}
      <div className="ui-container flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="space-y-1">
          <h2 className="text-lg font-header text-text-primary">Add GIWA Sepolia to your wallet</h2>
          <p className="text-xs text-muted-blue">
            One click to add or switch to the network, or copy the details below to add it manually.
          </p>
        </div>
        <button
          onClick={addNetwork}
          disabled={isPending}
          className="flex h-12 w-fit items-center justify-center gap-2 rounded-xl bg-accent-warm px-6 text-sm font-bold uppercase tracking-[0.15em] text-background transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 20 }}>
              progress_activity
            </span>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_link</span>
              Add Network
            </>
          )}
        </button>
      </div>

      {/* Network details */}
      <div className="ui-container overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 sm:px-8">
          <h2 className="text-2xl font-header text-text-primary">Network Details</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-blue">Chain ID</span>
            <span className="rounded-md bg-accent-warm/15 px-2.5 py-1 font-display text-sm font-bold text-accent-warm">
              {giwaSepolia.id}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px bg-white/5 sm:grid-cols-2 lg:grid-cols-4">
          {DETAIL_ROWS.map((row) => (
            <div key={row.label} className="flex flex-col gap-2 bg-white/[0.02] px-6 py-5 sm:px-8 lg:px-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">{row.label}</span>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-accent-warm" style={{ fontSize: 20 }}>{row.icon}</span>
                <span className="font-display text-base font-bold text-text-primary">{row.value}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 border-t border-white/10 px-6 py-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
          <CopyRow label="Network Name" value={giwaSepolia.name} />
          <CopyRow label="RPC (HTTP)" value={RPC_HTTP} />
          <CopyRow label="Block Explorer" value={EXPLORER_URL} />
        </div>
      </div>

      {/* L1 hint */}
      <p className="text-xs text-muted-blue">
        Need more? {giwaSepolia.name} settles to Ethereum Sepolia — get Sepolia ETH from a public
        faucet and bridge it via{" "}
        <a
          href="https://docs.giwa.io/get-started/bridging"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-accent-warm hover:underline"
        >
          the GIWA bridge
        </a>
        .
      </p>
    </div>
  );
}
