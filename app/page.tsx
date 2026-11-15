import type { Metadata } from "next";
import { LaunchpadMint } from "@/components/launchpad/LaunchpadMint";
import { launchpadMetadata } from "@/lib/launchpad/metadata";

// The launchpad is the default entry point. The full landing page lives at
// "/home" and is reachable from the header.
export const metadata: Metadata = launchpadMetadata;

export default function RootPage() {
  return <LaunchpadMint />;
}
