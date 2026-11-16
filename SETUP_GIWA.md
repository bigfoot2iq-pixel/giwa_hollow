# GIWA ARIWA — Setup

A GIWA Sepolia dApp: **faucet**, an **ARIWA ERC-20**, **an AMM ARIWA/ETH swap pool**, platform **raffles**, and a **pay-to-play game** with a leaderboard. Ported from the Robinhood Raffles app and rebranded for GIWA.

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

# Fixed-rate ARIWA/ETH swap pool (needs token; seeds ETH + ARIWA)
# Reads SWAP_POOL_TOKENS_PER_ETH / SWAP_POOL_ETH_FUNDING / SWAP_POOL_TOKEN_FUNDING.
npx hardhat run scripts/deploy-swap-pool.ts --network giwaSepolia
#   → set NEXT_PUBLIC_SWAP_POOL_ADDRESS

# Raffles (needs token + WATCHDOG_ADDRESS)
npx hardhat run scripts/deploy-raffles.ts --network giwaSepolia
#   → set NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS

# Pay-to-play game
npx hardhat run scripts/deploy-game.ts --network giwaSepolia
#   → set NEXT_PUBLIC_GAME_CONTRACT_ADDRESS

# NFT launchpad collection (public phase/price/cap are owner-configurable)
npx hardhat run scripts/deploy-launchpad-nft.ts --network giwaSepolia
#   → set NEXT_PUBLIC_LAUNCHPAD_NFT_ADDRESS
#   → contract owner defaults to NEXT_PUBLIC_ADMIN_WALLET (LAUNCHPAD_NFT_OWNER overrides)
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
| `/trade` | Buy/sell ARIWA against the live AMM pool |
| `/launchpad` | Mint the launchpad NFT collection (holder-gated) |
| `/create` | Community form to request a collection launch |
| `/raffles` | **Platform** raffles created by the admin (maintenance until toggled) |
| `/admin` | Admin-only: launchpad, raffles, NFT collection controls and launch requests |
| `/leaderboard` | Community and token-holder rankings |

## Notes
- **Swap pool** — `/trade` reads live reserves and price samples from `AriwaSwapPool`, a constant-product (x × y = k) AMM. The deploy script seeds liquidity at an opening price (default 10,000 ARIWA per ETH) and sets a 0.30% swap fee; override with the `SWAP_POOL_*` vars. The owner can change the fee (capped at 5%), pause trading, or withdraw reserves. Top up later with `addLiquidity` or a plain ETH transfer.
- **Faucet is link-only** (no server drip wallet) — it points at the official GIWA/Nodit faucets.
- Twitter/X login, waitlist, and checker pages from the source app were **omitted**; re-add from
  `../robinhood_hollow` if needed.
- The token ticker is **ARIWA**. Solidity contracts are `AriwaToken`, `RobinhoodRaffles` (raffles),
  and `TheAriwaGame`. DB table names (`litvm_raffle_*`, `game_users`) and the
  `NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS` env var were intentionally left unchanged to avoid churn.
