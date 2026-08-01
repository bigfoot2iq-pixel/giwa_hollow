/**
 * Read-only: measures the actual PostgREST response size of each hot query, then
 * multiplies by the observed request rate to attribute Supabase egress per route.
 * Rates come from the Vercel log export (only STALE + MISS reach the function;
 * HIT is served by the CDN and never touches Supabase).
 */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const URL_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RID = "bce28cfc-1e97-43f1-a0d1-6e0c0d640dc9"; // ariwa
const RID2 = "5e3e5cfd-0000-0000-0000-000000000000";
const WALLET = "0xdd658cfd71fc87b0c9e16e6a83741e856bef7f58";

type Probe = { label: string; path: string; headers?: Record<string, string>; perDay: number };

// reqs/day that actually execute the function (STALE + MISS from the log export)
const probes: Probe[] = [
  { label: "/api/raffles :: raffles select *", path: `/litvm_raffle_raffles?select=*&order=created_at.desc`, perDay: 68550 },
  { label: "/api/raffles :: prizes", path: `/litvm_raffle_prizes?select=raffle_id,prize_type,prize_token_address,prize_amount,prize_token_id&raffle_id=in.(${RID})`, perDay: 68550 },
  { label: "/api/raffles/[id] :: raffle select *", path: `/litvm_raffle_raffles?select=*&slug=eq.ariwa`, perDay: 9155 },
  { label: "/api/raffles/[id] :: entries entry_count (THE BIG ONE)", path: `/litvm_raffle_entries?select=entry_count&raffle_id=eq.${RID}`, headers: { Prefer: "count=exact" }, perDay: 9155 },
  { label: "/api/raffles/[id] :: winners", path: `/litvm_raffle_winners?select=*&raffle_id=eq.${RID}`, perDay: 9155 },
  { label: "/api/raffles/[id] :: prizes", path: `/litvm_raffle_prizes?select=*&raffle_id=eq.${RID}`, perDay: 9155 },
  { label: "/api/entries GET :: single entry", path: `/litvm_raffle_entries?select=tokens_spent,entry_count&raffle_id=eq.${RID}&wallet_address=eq.${WALLET}`, perDay: 207194 },
  { label: "sync reconcile :: ALL entries paged (per page of 1000)", path: `/litvm_raffle_entries?select=wallet_address,entry_count&raffle_id=eq.${RID}&offset=0&limit=1000`, perDay: 0 },
];

let total = 0;
const rows: Array<[string, number, number, number]> = [];

for (const p of probes) {
  const res = await fetch(URL_BASE + p.path, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, ...(p.headers ?? {}) },
  });
  const body = Buffer.from(await res.arrayBuffer());
  // PostgREST responds gzipped when asked; Supabase meters bytes on the wire.
  const wire = gzipSync(body).length;
  const headerBytes = [...res.headers].reduce((n, [k, v]) => n + k.length + v.length + 4, 0);
  const perReq = wire + headerBytes;
  const perMonth = (perReq * p.perDay * 30) / 1e9;
  total += perMonth;
  rows.push([p.label, body.length, perReq, perMonth]);
}

console.log(
  `${"query".padEnd(52)} ${"raw B".padStart(9)} ${"wire B".padStart(8)} ${"GB/mo".padStart(7)}`
);
for (const [label, raw, wire, gb] of rows.sort((a, b) => b[3] - a[3])) {
  console.log(`${label.padEnd(52)} ${String(raw).padStart(9)} ${String(wire).padStart(8)} ${gb.toFixed(3).padStart(7)}`);
}
console.log(`\nattributed total: ${total.toFixed(2)} GB/month (free tier = 5 GB)`);

// The reconcile path re-reads every entry row on each sync; cost is per sync run.
const syncPage = rows.find((r) => r[0].includes("ALL entries paged"))!;
const pages = 10;
console.log(
  `\nsync reconcile full read: ${pages} pages x ${syncPage[2]} B = ${((syncPage[2] * pages) / 1e6).toFixed(1)} MB per sync run`
);
for (const [label, perDay] of [["cron every 30 min", 48], ["if 5-min TTL fully exercised", 288]] as const) {
  console.log(`  ${label}: ${((syncPage[2] * pages * perDay * 30) / 1e9).toFixed(2)} GB/month`);
}
void RID2;
