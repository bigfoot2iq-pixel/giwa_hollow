import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Trade ARIWA",
  description:
    "Buy and sell ARIWA against the live constant-product pool on GIWA Sepolia.",
};

export default function TradeLayout({ children }: { children: ReactNode }) {
  return children;
}
