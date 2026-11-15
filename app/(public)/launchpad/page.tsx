import type { Metadata } from "next";
import { LaunchpadMint } from "@/components/launchpad/LaunchpadMint";
import { launchpadMetadata } from "@/lib/launchpad/metadata";

export const metadata: Metadata = launchpadMetadata;

export default function LaunchpadPage() {
  return <LaunchpadMint />;
}
