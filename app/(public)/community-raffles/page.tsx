"use client";

import { RafflesExplorer } from "@/components/raffle";

export default function CommunityRafflesPage() {
  return (
    <RafflesExplorer
      scope="community"
      title="Community Raffles"
      showCreate
      emptyHint="No community raffles yet — connect your wallet and create the first one!"
    />
  );
}
