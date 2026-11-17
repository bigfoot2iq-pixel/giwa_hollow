"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowLeft, KeyRound, Loader2, ShieldAlert, Wallet } from "lucide-react";
import { useAdminStatus } from "@/lib/hooks";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { isAdmin, isLoading } = useAdminStatus(isConnected ? address : undefined);

  useEffect(() => {
    if (isConnected && !isLoading && !isAdmin) {
      console.warn("[AdminAccess] Unauthorized redirect", { address, isAdmin, isLoading });
      router.push("/home");
    }
  }, [address, isConnected, isLoading, isAdmin, router]);

  if (!isConnected) {
    return (
      <AdminGate
        title="The back room"
        body="Connect the admin wallet to open the door. Only the wallet that owns the contracts can come in."
        badge="Wallet required"
        icon={<Wallet className="size-5" />}
      >
        <ConnectButton.Custom>
          {({ openConnectModal, mounted }) =>
            mounted ? (
              <button onClick={openConnectModal} className="btn-ink h-11 px-5 text-[11px]">
                <Wallet className="size-3.5" />
                Connect wallet
              </button>
            ) : null
          }
        </ConnectButton.Custom>
      </AdminGate>
    );
  }

  if (isLoading) {
    return (
      <AdminGate
        title="Checking the guest list"
        body="Verifying admin permissions against the contract owner."
        badge="One moment"
        icon={<Loader2 className="size-5 animate-spin" />}
      >
        <span className="h-1 w-40 overflow-hidden rounded-full bg-ink/10">
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-iris" />
        </span>
      </AdminGate>
    );
  }

  if (!isAdmin) {
    return (
      <AdminGate
        title="This door isn't yours"
        body="Your wallet is connected, but it is not authorized for the admin console. Nothing to see back here."
        badge="Not on the list"
        icon={<ShieldAlert className="size-5" />}
      >
        <Link href="/home" className="btn-soft h-11 px-5 text-[11px]">
          <ArrowLeft className="size-3.5" />
          Back to ARIWA
        </Link>
      </AdminGate>
    );
  }

  return <>{children}</>;
}

function AdminGate({
  title,
  body,
  badge,
  icon,
  children,
}: {
  title: string;
  body: string;
  badge: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="page-shell flex min-h-[62vh] items-center justify-center">
      <div className="ui-container w-full max-w-xl overflow-hidden rounded-[30px] p-8 text-center sm:p-12">
        <div className="relative mx-auto flex size-24 items-center justify-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#f7e3a0,#f6c7d8,#d8c9fa)] opacity-70 blur-md"
          />
          <span className="relative size-20 overflow-hidden rounded-full border-4 border-paper shadow-lg dark:border-white/15">
            <Image
              src="/art/nft/888.webp"
              alt=""
              fill
              sizes="80px"
              className="object-cover"
            />
          </span>
          <span className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border border-ink/10 bg-paper text-iris shadow-sm">
            {icon}
          </span>
        </div>

        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-iris/20 bg-iris/[0.06] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.18em] text-iris-deep">
          <KeyRound className="size-2.5" />
          {badge}
        </span>
        <h1 className="mt-3 font-header text-3xl font-extrabold tracking-[-0.04em] text-ink">
          {title}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[12px] leading-6 text-ink-mute">{body}</p>
        <div className="mt-6 flex items-center justify-center gap-2.5">{children}</div>
      </div>
    </div>
  );
}
