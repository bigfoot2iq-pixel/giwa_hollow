import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { giwaSepolia } from '@/lib/contracts/config';
import { http, cookieStorage, createStorage } from 'wagmi';

export const wagmiConfig = getDefaultConfig({
  appName: 'GIWA Raffles',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '2f05ae7f1116030fde2d36508f472bfb',
  chains: [giwaSepolia],
  transports: {
    [giwaSepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia-rpc.giwa.io'),
  },
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
});
