# GIWA ARIWA

A dApp on **GIWA Sepolia** (OP Stack L2): a gas faucet hub, an ARIWA ERC-20, an AMM ARIWA/ETH **swap pool**, platform **raffles**, and a pay-to-play **game** with a leaderboard.

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
| `NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS` | ARIWA ERC-20 (set after deploy) |
| `NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS` | Raffles contract (set after deploy) |
| `NEXT_PUBLIC_GAME_CONTRACT_ADDRESS` | Game contract (set after deploy) |
| `NEXT_PUBLIC_LAUNCHPAD_NFT_ADDRESS` | Launchpad AriwaNFT (ERC721A, set after deploy) |
| `NEXT_PUBLIC_SWAP_POOL_ADDRESS` | Constant-product ARIWA/ETH AMM pool (set after deploy) |
| `SWAP_POOL_TOKENS_PER_ETH` / `SWAP_POOL_ETH_FUNDING` / `SWAP_POOL_TOKEN_FUNDING` / `SWAP_POOL_FEE_BPS` | Swap pool deploy inputs: opening price, seed liquidity, swap fee |
| `ETHEREUM_RPC_URL` / `BNB_RPC_URL` / `BASE_RPC_URL` / `INK_RPC_URL` | Optional RPC overrides for the launchpad holder check |
| `CRON_SECRET` | Auth for `/api/cron` |

## Pages

| Route | What |
|---|---|
| `/faucet` | Links to GIWA + Nodit faucets, add-network button, chain params |
| `/trade` | Buy/sell ARIWA against the live AMM pool |
| `/launchpad` | Mint the launchpad NFT collection (holder-gated) |
| `/create` | Community form to request a collection launch |
| `/raffles` | Platform raffles created by the admin (maintenance until toggled) |
| `/leaderboard` | Community and token-holder rankings |
| `/admin` | Admin-only: launchpad (default tab), raffles, NFT collection controls, launch requests |

## Contracts

`contracts/` - `AriwaToken.sol` (claim ERC-20, 12h cooldown), `AriwaSwapPool.sol` (constant-product ARIWA/ETH AMM), `AriwaRaffles.sol`, `AriwaNFT.sol` (ERC721A launchpad collection), `TheAriwaGame.sol`, `StakingRewards.sol`.

```bash
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy-ariwa-token.ts   --network giwaSepolia
npx hardhat run scripts/deploy-swap-pool.ts     --network giwaSepolia
npx hardhat run scripts/deploy-raffles.ts       --network giwaSepolia
npx hardhat run scripts/deploy-game.ts          --network giwaSepolia
npx hardhat run scripts/deploy-launchpad-nft.ts --network giwaSepolia
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
- **Swap pool** — `/trade` reads live reserves and price samples from `AriwaSwapPool`, a constant-product (x × y = k) AMM. The deploy script seeds liquidity at an opening price (default 10,000 ARIWA per ETH) and sets a 0.30% swap fee; override with the `SWAP_POOL_*` vars. The owner can change the fee (capped at 5%), pause trading, or withdraw reserves. Top up with `addLiquidity(tokenAmount)` (approve ARIWA first) or a plain ETH transfer.
- **Launchpad holder gate** - the Launchpad tab of `/admin` configures a minimum native balance on Ethereum, Base, Ink and/or BNB Chain. Each chain keeps its fixed native currency (ETH on Ethereum/Base/Ink, BNB on BNB Chain); only the minimum is editable. Defaults are `0.001 ETH` on Ethereum/Base/Ink and `0.003 BNB` on BNB Chain. The check runs server-side against public RPCs (override with `ETHEREUM_RPC_URL`, `BNB_RPC_URL`, `BASE_RPC_URL`, `INK_RPC_URL`). The holder rule is a UI/API gate; the NFT contract enforces the public phase, price, immutable 2,222 supply and per-wallet cap on-chain.
- **AriwaNFT** — the launchpad collection mirrors the Elyziuma contract: ERC721A, `MAX_SUPPLY = 2222`, `maxPerWallet` starts at 1, `publicMintOpen` is an owner switch, and mint proceeds sit in the contract until the owner withdraws. The owner opens/closes the phase, changes the price and cap, mints to any wallet and sweeps the balance from the Launchpad tab of `/admin`.
- **Raffles maintenance** — `/raffles` defaults to a maintenance screen. Toggle it live from Admin → Raffles.
- Token ticker is **ARIWA**. Some internal names (`litvm_raffle_*` DB tables, `NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS`) kept from the source app to avoid churn.
