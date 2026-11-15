import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Trade ARIWA",
  description:
    "Buy and sell ARIWA against the fixed-rate on-chain pool on GIWA Sepolia.",
};

export default function TradeLayout({ children }: { children: ReactNode }) {
  return children;
}
