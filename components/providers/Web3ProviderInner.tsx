"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "@/lib/wagmi-config";
import { giwaSepolia } from "@/lib/contracts/config";
import { ReactNode, useState } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";

export default function Web3ProviderInner({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        gcTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  const rainbowTheme =
    resolvedTheme === "dark"
      ? darkTheme({
          accentColor: "#8b78f2",
          accentColorForeground: "#fffdf9",
          borderRadius: "large",
          fontStack: "system",
          overlayBlur: "small",
        })
      : lightTheme({
          accentColor: "#6c55e0",
          accentColorForeground: "#fffdf9",
          borderRadius: "large",
          fontStack: "system",
        });

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={true}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={giwaSepolia} theme={rainbowTheme}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
