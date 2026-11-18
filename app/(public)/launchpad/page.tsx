import type { Metadata } from "next";
import { headers } from "next/headers";
import { LaunchpadMint } from "@/components/launchpad/LaunchpadMint";
import { getIpMintStatus } from "@/lib/launchpad/ip-gate";
import { launchpadMetadata } from "@/lib/launchpad/metadata";

export const metadata: Metadata = launchpadMetadata;

// The one-mint-per-network status depends on the request IP, so this page
// cannot be cached as a static document.
export const dynamic = "force-dynamic";

export default async function LaunchpadPage() {
  const requestHeaders = await headers();
  const ipStatus = await getIpMintStatus(requestHeaders);

  return <LaunchpadMint ipMinted={ipStatus.used} />;
}
