import { defineChain } from "viem";

// GIWA Sepolia — Upbit/Dunamu's OP Stack Ethereum L2 testnet (settles to Ethereum Sepolia).
export const giwaSepolia = defineChain({
  id: 91342,
  name: "GIWA Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rpc.giwa.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "GIWA Explorer",
      url: "https://sepolia-explorer.giwa.io",
    },
  },
  testnet: true,
});

// Hardhat local network for development (matches hardhat.config.ts chainId)
export const hardhatLocal = defineChain({
  id: 91342,
  name: "Hardhat Local",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
  },
  testnet: true,
});

export const contracts = {
  ariwaToken: {
    address: process.env.NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS as `0x${string}`,
  },
  raffles: {
    address: process.env.NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS as `0x${string}`,
  },
} as const;

export const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET as `0x${string}`;
