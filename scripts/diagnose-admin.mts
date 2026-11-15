/**
 * Read-only diagnostic: reconciles DB raffle rows against on-chain state and
 * checks that the server-side signer keys can actually authorize admin writes.
 * Run: npx tsx scripts/diagnose-admin.mts
 */
import "dotenv/config";
import { createPublicClient, http, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// .env.local is not loaded by dotenv/config by default
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const RPC = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL!;
const RAFFLES = process.env.NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS as `0x${string}`;

const chain = {
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 91342),
  name: "GIWA Sepolia",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: { default: { http: [RPC] } },
} as const;

const abi = [
  { type: "function", name: "owner", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "watchdog", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "raffleCounter", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "paused", inputs: [], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "raffleToken", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  {
    type: "function", name: "raffles", inputs: [{ type: "uint256" }],
    outputs: [
      { name: "prizeType", type: "uint8" }, { name: "prizeToken", type: "address" },
      { name: "state", type: "uint8" }, { name: "prizeCount", type: "uint256" },
      { name: "isNFT", type: "bool" }, { name: "hasWinners", type: "bool" },
      { name: "creator", type: "address" }, { name: "endTime", type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const;

const STATE = ["CREATED", "ACTIVE", "COMPLETED", "CANCELLED"];

const client = createPublicClient({ chain, transport: http(RPC) });

const line = (s: string) => console.log(s);
const hr = () => console.log("-".repeat(78));

async function main() {
  line(`RPC:            ${RPC}`);
  line(`Raffles:        ${RAFFLES}`);
  hr();

  const [owner, watchdog, counter, paused, token] = await Promise.all([
    client.readContract({ address: RAFFLES, abi, functionName: "owner" }),
    client.readContract({ address: RAFFLES, abi, functionName: "watchdog" }),
    client.readContract({ address: RAFFLES, abi, functionName: "raffleCounter" }),
    client.readContract({ address: RAFFLES, abi, functionName: "paused" }),
    client.readContract({ address: RAFFLES, abi, functionName: "raffleToken" }),
  ]);

  line("== CONTRACT ==");
  line(`owner:          ${owner}`);
  line(`watchdog:       ${watchdog}`);
  line(`raffleToken:    ${token}`);
  line(`raffleCounter:  ${counter}`);
  line(`paused:         ${paused}`);
  hr();

  line("== ENV / SIGNERS ==");
  line(`NEXT_PUBLIC_ADMIN_WALLET:  ${process.env.NEXT_PUBLIC_ADMIN_WALLET}`);
  line(`WATCHDOG_ADDRESS:          ${process.env.WATCHDOG_ADDRESS}`);
  line(`WATCHDOG_PRIVATE_KEY set:  ${!!process.env.WATCHDOG_PRIVATE_KEY}`);
  line(`DEPLOYER_PRIVATE_KEY set:  ${!!process.env.DEPLOYER_PRIVATE_KEY}`);
  line(`NEXT_PUBLIC_HOLLOW_TOKEN:  ${process.env.NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS}`);

  if (process.env.DEPLOYER_PRIVATE_KEY) {
    const k = process.env.DEPLOYER_PRIVATE_KEY.startsWith("0x")
      ? process.env.DEPLOYER_PRIVATE_KEY
      : `0x${process.env.DEPLOYER_PRIVATE_KEY}`;
    const acct = privateKeyToAccount(k as `0x${string}`);
    const bal = await client.getBalance({ address: acct.address });
    line(`DEPLOYER address:          ${acct.address}`);
    line(`  == owner?               ${acct.address.toLowerCase() === (owner as string).toLowerCase()}`);
    line(`  == watchdog?            ${acct.address.toLowerCase() === (watchdog as string).toLowerCase()}`);
    line(`  balance:                ${Number(bal) / 1e18} ETH`);
  }
  const wdBal = await client.getBalance({ address: watchdog as `0x${string}` });
  line(`watchdog balance:          ${Number(wdBal) / 1e18} ETH`);
  hr();

  // ---- DB ----
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: admins, error: adminErr } = await supa
    .from("litvm_raffle_admin").select("wallet_address");
  line("== litvm_raffle_admin ==");
  if (adminErr) line(`ERROR: ${adminErr.message}`);
  else admins?.forEach((a) => line(`  ${a.wallet_address}`));
  hr();

  const { data: raffles, error: rErr } = await supa
    .from("litvm_raffle_raffles")
    .select("id, title, slug, chain_raffle_id, max_participants, start_date, end_date, created_at")
    .order("created_at", { ascending: false });

  if (rErr) { line(`raffles query ERROR: ${rErr.message}`); return; }

  const { data: entries } = await supa.from("litvm_raffle_entries").select("raffle_id, wallet_address");
  const byRaffle = new Map<string, Set<string>>();
  const rowCount = new Map<string, number>();
  for (const e of entries ?? []) {
    if (!byRaffle.has(e.raffle_id)) byRaffle.set(e.raffle_id, new Set());
    byRaffle.get(e.raffle_id)!.add(e.wallet_address.toLowerCase());
    rowCount.set(e.raffle_id, (rowCount.get(e.raffle_id) ?? 0) + 1);
  }

  line(`== DB RAFFLES (${raffles?.length ?? 0}) ==`);
  for (const r of raffles ?? []) {
    let onchain = "  <no chain_raffle_id>";
    if (r.chain_raffle_id != null) {
      try {
        const d = (await client.readContract({
          address: RAFFLES, abi, functionName: "raffles", args: [BigInt(r.chain_raffle_id)],
        })) as readonly [number, string, number, bigint, boolean, boolean, string, bigint];
        const isPlatform = d[6] === "0x0000000000000000000000000000000000000000";
        onchain =
          `  chainId=${r.chain_raffle_id} state=${STATE[d[2]]} prizeCount=${d[3]} isNFT=${d[4]}` +
          ` hasWinners=${d[5]}\n  creator=${d[6]} (${isPlatform ? "PLATFORM" : "COMMUNITY"})` +
          ` endTime=${d[7] === 0n ? "0 (owner-managed)" : new Date(Number(d[7]) * 1000).toISOString()}` +
          `\n  prizeToken=${d[1]}`;
        if (d[1] === "0x0000000000000000000000000000000000000000") {
          onchain += "\n  *** RAFFLE DOES NOT EXIST ON THIS CONTRACT ***";
        }
      } catch (e) {
        onchain = `  READ FAILED: ${(e as Error).message.split("\n")[0]}`;
      }
    }
    line("");
    line(`[${r.title}] slug=${r.slug}`);
    line(`  db_id=${r.id}`);
    line(`  entries_rows=${rowCount.get(r.id) ?? 0} unique_wallets=${byRaffle.get(r.id)?.size ?? 0} max_participants=${r.max_participants}`);
    line(`  start=${r.start_date} end=${r.end_date}`);
    line(onchain);
  }
  hr();
  line("== ORPHAN CHAIN RAFFLES (on chain, not in DB) ==");
  const known = new Set((raffles ?? []).map((r) => r.chain_raffle_id));
  for (let i = 1n; i <= (counter as bigint); i++) {
    if (known.has(Number(i))) continue;
    const d = (await client.readContract({
      address: RAFFLES, abi, functionName: "raffles", args: [i],
    })) as readonly [number, string, number, bigint, boolean, boolean, string, bigint];
    if (d[1] === "0x0000000000000000000000000000000000000000") continue;
    const isPlatform = d[6] === "0x0000000000000000000000000000000000000000";
    line(`  chainId=${i} state=${STATE[d[2]]} creator=${d[6]} (${isPlatform ? "PLATFORM" : "COMMUNITY"}) prizeToken=${d[1]}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
