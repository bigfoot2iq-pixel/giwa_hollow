# GIWA ARIWA — Setup

A GIWA Sepolia dApp: **faucet**, **claim a token every 12h**, **raffles** (community + platform), and a **pay-to-play game** with a leaderboard. Ported from the Robinhood Raffles app and rebranded for GIWA.

## Network — GIWA Sepolia
| | |
|---|---|
| Chain ID | `91342` |
| RPC | `https://sepolia-rpc.giwa.io` |
| Explorer | `https://sepolia-explorer.giwa.io` |
| Native token | ETH |
| Settlement (L1) | Ethereum Sepolia |
| Stack | OP Stack |

Faucets (for gas): [faucet.giwa.io](https://faucet.giwa.io) (0.005 ETH/24h) · [Nodit](https://faucet.lambda256.io/giwa-sepolia) (0.01 ETH/24h). These are surfaced in-app at `/faucet`.

## 1. Install
```bash
npm install
```

## 2. Environment
Copy `.env.example` → `.env.local` and fill in:
- **Supabase**: create a project at supabase.com → copy URL + anon key + service-role key.
- **WalletConnect**: project id from https://cloud.reown.com.
- **Admin/Watchdog**: your wallet address (creates platform raffles, ends raffles, owns contracts).
- **DEPLOYER_PRIVATE_KEY**: a funded GIWA Sepolia key for deploying contracts.
- Contract addresses are filled **after** step 4.

## 3. Database (Supabase)
Run every file in `supabase/migrations/` (in filename order) via the Supabase SQL editor.
Tables/functions are prefixed `litvm_raffle_*` (internal names, kept as-is). Storage bucket
`litvm-raffle-avatars` is used for game profile avatars — create it (public) if you want avatars.

## 4. Deploy contracts (GIWA Sepolia)
```bash
npx hardhat compile

# ERC-20 claim token — deploys with a 12h claim cooldown + 4 categories
npx hardhat run scripts/deploy-ariwa-token.ts --network giwaSepolia
#   → set NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS

# Raffles (needs token + WATCHDOG_ADDRESS)
npx hardhat run scripts/deploy-raffles.ts --network giwaSepolia
#   → set NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS

# Pay-to-play game
npx hardhat run scripts/deploy-game.ts --network giwaSepolia
#   → set NEXT_PUBLIC_GAME_CONTRACT_ADDRESS
```
Paste each printed address into `.env.local`.

## 5. Run
```bash
npm run dev
```

## Pages
| Route | What |
|---|---|
| `/faucet` | Links to official GIWA + Nodit faucets, "add network" button, chain params |
| `/claim` | Claim the GIWA token (12h cooldown, on-chain) |
| `/community-raffles` | **Users** create + enter their own raffles |
| `/raffles` | **Platform** raffles created by the admin |
| `/admin` | Admin-only: create/activate/end raffles (gated by `NEXT_PUBLIC_ADMIN_WALLET`) |
| `/game` + `/leaderboard` | Pay-to-play game + rankings |

## Notes
- **Faucet is link-only** (no server drip wallet) — it points at the official GIWA/Nodit faucets.
- Twitter/X login, waitlist, and checker pages from the source app were **omitted**; re-add from
  `../robinhood_hollow` if needed.
- The token ticker is **ARIWA**. Solidity contracts are `AriwaToken`, `RobinhoodRaffles` (raffles),
  and `TheAriwaGame`. DB table names (`litvm_raffle_*`, `game_users`) and the
  `NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS` env var were intentionally left unchanged to avoid churn.
