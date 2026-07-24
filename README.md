# GIWA ARIWA

A dApp on **GIWA Sepolia** (OP Stack L2): a gas faucet hub, a claim-a-token-every-12h ERC-20, community + platform **raffles**, and a pay-to-play **game** with a leaderboard.

Built with Next.js (App Router), wagmi + viem + RainbowKit, Supabase, and Hardhat/Solidity contracts.

## Network — GIWA Sepolia

| | |
|---|---|
| Chain ID | `91342` |
| RPC | `https://sepolia-rpc.giwa.io` |
| Explorer | `https://sepolia-explorer.giwa.io` |
| Native token | ETH |
| Settlement (L1) | Ethereum Sepolia |
| Stack | OP Stack |

Gas faucets: [faucet.giwa.io](https://faucet.giwa.io) (0.005 ETH/24h) · [Nodit](https://faucet.lambda256.io/giwa-sepolia) (0.01 ETH/24h). Surfaced in-app at `/faucet`.

## Stack

- **Frontend**: Next.js 16 (App Router), React, Tailwind CSS v4, framer-motion
- **Web3**: wagmi, viem, RainbowKit, WalletConnect
- **Backend**: Supabase (Postgres + storage), Next.js API routes
- **Contracts**: Solidity (OpenZeppelin), Hardhat, TypeChain

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in values (see below)
npm run dev                  # http://localhost:3000
```

Full deploy walkthrough (Supabase migrations + contract deploys) → **[SETUP_GIWA.md](./SETUP_GIWA.md)**.

## Environment

Copy `.env.example` → `.env.local` and fill in:

| Var | What |
|---|---|
| `NEXT_PUBLIC_CHAIN_ID` / `NEXT_PUBLIC_RPC_URL` / `NEXT_PUBLIC_EXPLORER_URL` | GIWA Sepolia network params |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-only) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect / Reown project id |
| `NEXT_PUBLIC_ADMIN_WALLET` | Admin wallet — gates `/admin`, owns contracts |
| `WATCHDOG_ADDRESS` | Ends raffles / picks winners |
| `DEPLOYER_PRIVATE_KEY` | Funded GIWA Sepolia key for contract deploys |
| `NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS` | Claim ERC-20 (set after deploy) |
| `NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS` | Raffles contract (set after deploy) |
| `NEXT_PUBLIC_GAME_CONTRACT_ADDRESS` | Game contract (set after deploy) |
| `CRON_SECRET` | Auth for `/api/cron` |

## Pages

| Route | What |
|---|---|
| `/faucet` | Links to GIWA + Nodit faucets, add-network button, chain params |
| `/claim` | Claim the ARIWA token (12h on-chain cooldown) |
| `/community-raffles` | Users create + enter their own raffles |
| `/raffles` | Platform raffles created by the admin |
| `/dashboard` | User dashboard |
| `/game` + `/leaderboard` | Pay-to-play game + rankings |
| `/admin` | Admin-only: create/activate/end raffles (gated by `NEXT_PUBLIC_ADMIN_WALLET`) |

## Contracts

`contracts/` — `AriwaToken.sol` (claim ERC-20, 12h cooldown), `AriwaRaffles.sol`, `TheAriwaGame.sol`, `StakingRewards.sol`.

```bash
npx hardhat compile
npx hardhat run scripts/deploy-ariwa-token.ts --network giwaSepolia
npx hardhat run scripts/deploy-raffles.ts     --network giwaSepolia
npx hardhat run scripts/deploy-game.ts        --network giwaSepolia
```

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm test` | Node test runner (`app/**/*.test.ts`) |

## Notes

- **Faucet is link-only** — no server drip wallet; points at official GIWA/Nodit faucets.
- Token ticker is **ARIWA**. Some internal names (`litvm_raffle_*` DB tables, `NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS`) kept from the source app to avoid churn.
