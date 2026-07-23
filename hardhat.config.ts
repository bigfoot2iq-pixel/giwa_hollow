import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      // GIWA is an OP Stack chain (post-Ecotone) — enable Cancun so OpenZeppelin 5.4's
      // mcopy-based utils compile.
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 91342,
      hardfork: "london",
      initialBaseFeePerGas: 0,
    },
    giwaSepolia: {
      url: process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rpc.giwa.io",
      chainId: 91342,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    // GIWA Sepolia uses a Blockscout-style explorer; API key is not required.
    apiKey: {
      giwaSepolia: process.env.ETHERSCAN_API_KEY || "abc",
    },
    customChains: [
      {
        network: "giwaSepolia",
        chainId: 91342,
        urls: {
          apiURL: "https://sepolia-explorer.giwa.io/api",
          browserURL: "https://sepolia-explorer.giwa.io",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
  paths: {
    sources: "./contracts",
    tests: "./contracts/test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
