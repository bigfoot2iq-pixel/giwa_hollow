/**
 * One-off repair: write the on-chain winners of an already-COMPLETED raffle into
 * litvm_raffle_winners when the settling invocation died before the DB write.
 *
 * Refuses to run unless the raffle is COMPLETED on-chain and has zero winner
 * rows, so it can never overwrite or duplicate a good settlement.
 *
 * Usage: node --experimental-strip-types scripts/backfill-raffle-winners.mts <slug> [endTxHash] [--apply]
 * Without --apply it prints the rows it would insert and exits.
 */
import { createPublicClient, http } from "viem";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const positional = args.filter((a) => !a.startsWith("--"));
const SLUG = positional[0];
const END_TX = (positional[1] ?? null) as `0x${string}` | null;
if (!SLUG) { console.error("usage: backfill-raffle-winners.mts <slug> [endTxHash] [--apply]"); process.exit(1); }

const RPC = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL!;
const RAFFLES = process.env.NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS as `0x${string}`;
const chain = {
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 91342), name: "GIWA Sepolia",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: { default: { http: [RPC] } },
} as const;
const client = createPublicClient({ chain, transport: http(RPC) });

const abi = [
  { type: "function", name: "getRaffleState", inputs: [{ type: "uint256" }], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "getWinners", inputs: [{ type: "uint256" }], outputs: [{ type: "address[]" }], stateMutability: "view" },
] as const;

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const { data: raffle, error } = await supa
  .from("litvm_raffle_raffles").select("id, title, slug, chain_raffle_id").eq("slug", SLUG).single();
if (error || !raffle) { console.error("raffle not found:", error?.message); process.exit(1); }
if (raffle.chain_raffle_id == null) { console.error("raffle has no chain_raffle_id"); process.exit(1); }

const state = Number(await client.readContract({ address: RAFFLES, abi, functionName: "getRaffleState", args: [BigInt(raffle.chain_raffle_id)] }));
if (state !== 2) { console.error(`refusing: on-chain state is ${state}, expected COMPLETED(2)`); process.exit(1); }

const { count: existing } = await supa
  .from("litvm_raffle_winners").select("id", { count: "exact", head: true }).eq("raffle_id", raffle.id);
if ((existing ?? 0) > 0) { console.error(`refusing: raffle already has ${existing} winner rows`); process.exit(1); }

const winners = (await client.readContract({ address: RAFFLES, abi, functionName: "getWinners", args: [BigInt(raffle.chain_raffle_id)] })) as string[];
if (winners.length === 0) { console.error("on-chain getWinners is empty; nothing to backfill"); process.exit(1); }

// Verify the supplied tx hash really is the settlement for this raffle before
// publishing it as the distribution link.
if (END_TX) {
  const receipt = await client.getTransactionReceipt({ hash: END_TX });
  if (receipt.status !== "success" || receipt.to?.toLowerCase() !== RAFFLES.toLowerCase()) {
    console.error("refusing: end tx did not succeed against the raffles contract");
    process.exit(1);
  }
}

const { data: prizes } = await supa
  .from("litvm_raffle_prizes").select("prize_amount, prize_token_id")
  .eq("raffle_id", raffle.id).order("created_at", { ascending: true });

const rows = winners.map((wallet, i) => ({
  raffle_id: raffle.id,
  wallet_address: wallet.toLowerCase(),
  prize_amount: prizes?.[i]?.prize_amount ?? null,
  prize_token_id: prizes?.[i]?.prize_token_id ?? null,
  distribution_tx_hash: END_TX,
}));

console.log(`raffle "${raffle.title}" (${raffle.slug}) chain=${raffle.chain_raffle_id} state=COMPLETED existingWinnerRows=${existing}`);
console.log("rows to insert:");
console.log(JSON.stringify(rows, null, 2));

if (!APPLY) { console.log("\nDRY RUN — re-run with --apply to write."); process.exit(0); }

const { error: insertErr } = await supa.from("litvm_raffle_winners").insert(rows);
if (insertErr) { console.error("insert failed:", insertErr.message); process.exit(1); }
console.log(`inserted ${rows.length} winner row(s)`);

for (const wallet of winners) {
  const { error: incErr } = await supa.rpc("litvm_raffle_increment_user_wins", { p_wallet: wallet.toLowerCase() });
  console.log(`  increment wins ${wallet}: ${incErr ? `FAILED ${incErr.message}` : "ok"}`);
}
