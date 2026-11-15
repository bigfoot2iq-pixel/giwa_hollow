import type { Metadata } from "next";
import { About } from "@/components/landing/about";
import { CollectionSection } from "@/components/landing/collection";
import { FinalCta } from "@/components/landing/final-cta";
import { Hero } from "@/components/landing/hero";
import { LaunchpadSection } from "@/components/landing/launchpad";
import { RaffleSection } from "@/components/landing/raffle";
import { TokenSection } from "@/components/landing/token";

export const metadata: Metadata = {
  title: "Home",
  description:
    "The first PFP NFT collection on GIWA, featuring 2,222 unique NFTs. ARIWA brings NFTs, token trading, community rewards, and NFT launches into one ecosystem.",
  openGraph: {
    title: "ARIWA — The First PFP Collection on GIWA",
    description:
      "2,222 unique NFTs on GIWA. Trade the token, enter raffles, and launch a collection in one ecosystem.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <div className="relative">
      <Hero />
      <About />
      <TokenSection />
      <CollectionSection />
      <LaunchpadSection />
      <RaffleSection />
      <FinalCta />
    </div>
  );
}
