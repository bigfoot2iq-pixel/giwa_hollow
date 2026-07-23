"use client";

import { RafflesExplorer } from "@/components/raffle";

export default function RafflesPage() {
  return (
    <RafflesExplorer
      scope="platform"
      title="Raffles Explorer"
      emptyHint="Check back soon for new raffles!"
    />
  );
}
