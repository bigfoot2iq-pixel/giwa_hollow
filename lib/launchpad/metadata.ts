import type { Metadata } from "next";

/**
 * Shared metadata for the launchpad surface. It is served from both "/" (the
 * default entry point) and "/launchpad", so the two routes stay in sync.
 */
export const launchpadMetadata: Metadata = {
  title: "Launchpad",
  description:
    "Mint ARIWA on GIWA Sepolia. On-chain supply, holder-gated access, and instant delivery to your wallet.",
  keywords: [
    "ARIWA launchpad",
    "ARIWA",
    "GIWA NFT",
    "mint NFT",
    "GIWA Sepolia",
  ],
  openGraph: {
    title: "ARIWA Launchpad",
    description:
      "Mint ARIWA on GIWA Sepolia. On-chain supply and instant delivery.",
    type: "website",
  },
};
