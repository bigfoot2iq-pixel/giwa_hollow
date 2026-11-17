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

## 5. Launchpad artwork storage (Cloudflare R2)

The collection is stored in a **private** R2 bucket and served only through the app's
public metadata/image routes. The contract `baseURI` does not change.

### One-time setup
```bash
# Private bucket (do NOT add a public custom domain or r2.dev URL)
npx wrangler r2 bucket create ariwa-nft

# Route-handler upload sessions (required in production)
npx wrangler secret put UPLOAD_TOKEN_SECRET

# Local dev: put a random 32+ byte secret in .env.local
#   UPLOAD_TOKEN_SECRET=<openssl rand -hex 32>
```

`wrangler.jsonc` already binds the bucket as `NFT_BUCKET`. The app reads it through
the Worker binding; no R2 S3 keys are used at runtime.

### Publishing a collection
1. Open `/admin` → **Launchpad** → **Artwork & metadata**.
   If the `www` host is behind a Cloudflare challenge, the admin console is also
   reachable at `https://giwa-hollow.medfata3.workers.dev/admin`; the storage APIs
   still require the admin wallet signature.
2. Select `build/images` and `build/json` (the HashLips output folders).
3. Review the validation report, then **Upload & publish**.
4. Keep the tab open while the 2,222 files upload. If the connection drops,
   reopen the page, select the same folders, and press **Resume `<version>`**.
5. Preview the samples and click **Activate** (separate confirmation).
6. Public metadata updates within ~1 minute; image URLs carry `?v=<version>` so
   their long-lived caches stay correct.

Versions are immutable. Activating an older version is a rollback; deleting a
version removes every object under its prefix. The active version cannot be
deleted.

### Storage layout
```text
launchpad/active.json
launchpad/ariwa-genesis/v1/images/1.png ... 2222.png
launchpad/ariwa-genesis/v1/metadata/1.json ... 2222.json
launchpad/ariwa-genesis/v1/manifest.json
launchpad/ariwa-genesis/v1/collection.json
```

### Pinata fallback
The public routes serve Pinata while `launchpad/active.json` is absent. Keep
`LAUNCHPAD_METADATA_CID`, `LAUNCHPAD_IMAGE_CID` and `PINATA_GATEWAY_URL` until an
R2 version has been verified and active; remove them after a stability window.

Pinata's shared gateway (and the public `ipfs.io`/`dweb.link` fallbacks) can
rate-limit the Worker's egress and return `502` to the public routes. Activate an
R2 version before minting or exposing the collection to the explorer; the R2 path
never touches the legacy gateways.

The metadata directory contains `<id>.json` files and the artwork directory
contains the matching `<id>.png` files. Both are read server-side by
`/api/launchpad/metadata/[id].json` and `/api/launchpad/image/[id].png`.
Keep the contract base URI on the app proxy:
`https://www.ariwa.xyz/api/launchpad/metadata/`. Never set it to a
`gateway.pinata.cloud` URL — the gateway and CIDs must stay server-side.

The proxy tries `PINATA_GATEWAY_URL` first, then public IPFS gateways
(Filebase, ipfs.io, dweb.link). Pinata's public gateway can answer the Worker
with `429 Too Many Requests`; the fallback keeps the collection readable until
the artwork is moved to R2.

### Explorer / holder checklist
- Set `NEXT_PUBLIC_APP_URL=https://www.ariwa.xyz` so metadata image URLs are absolute.
- **Exempt `/api/launchpad/*` from the Cloudflare challenge.** A server-side
  metadata fetcher (Blockscout, marketplaces) cannot solve a browser challenge;
  it will see a 403 and render a broken NFT. In the Cloudflare dashboard:
  - Security → WAF → Custom rules → Create rule.
  - Expression:
    `(http.host eq "www.ariwa.xyz" and starts_with(http.request.uri.path, "/api/launchpad/"))`
  - Action: **Skip** (Managed Rules, Bot Fight Mode / Super Bot Fight Mode,
    Browser Integrity Check, and Security Level if available).
  - If the zone uses a Configuration Rule instead, set Security Level to
    **Essentially Off** for the same path. If the zone is in Under Attack Mode,
    turn it off or scope the exemption.
  - Test from a machine that is not carrying a browser cookie:
    `curl -sSI https://www.ariwa.xyz/api/launchpad/metadata/1.json`
    It must return `200`, not `403` with `Cf-Mitigated: challenge`.
- The NFT contract does **not** need to be verified for the token to be indexed;
  Blockscout indexes unverified ERC-721 contracts (the "not verified" label only
  hides the source/ABI tabs).
- The contract currently has `totalSupply = 0`. To see a token on the explorer
  before the public mint, use the admin **Owner mint** panel to mint token #1 to a
  treasury wallet, then open the Blockscout token page. This consumes token #1;
  skip it if you want #1 available to the public.

## 6. Run
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
