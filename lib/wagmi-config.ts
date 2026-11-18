import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { giwaSepolia } from '@/lib/contracts/config';
import { fallback, http, cookieStorage, createStorage } from 'wagmi';

// The official GIWA Sepolia endpoint is rate-limited. Use it first and fall
// back to Pocket Network's free public endpoint when a browser read is
// throttled, so the launchpad counters keep updating during traffic spikes.
const primaryRpc =
  process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia-rpc.giwa.io';
const fallbackRpc =
  process.env.NEXT_PUBLIC_FALLBACK_RPC_URL ||
  'https://giwa-sepolia-testnet.api.pocket.network';

export const wagmiConfig = getDefaultConfig({
  appName: 'GIWA Raffles',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '2f05ae7f1116030fde2d36508f472bfb',
  chains: [giwaSepolia],
  transports: {
    [giwaSepolia.id]: fallback([
      http(primaryRpc),
      ...(fallbackRpc !== primaryRpc ? [http(fallbackRpc)] : []),
    ]),
  },
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
});
