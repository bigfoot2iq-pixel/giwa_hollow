"use client";

import { ReactNode } from "react";
import dynamic from "next/dynamic";

const Web3ProviderInner = dynamic(
  () => import("./Web3ProviderInner").then((mod) => mod.default),
  { ssr: false }
);

export function Web3Provider({ children }: { children: ReactNode }) {
  return <Web3ProviderInner>{children}</Web3ProviderInner>;
}
