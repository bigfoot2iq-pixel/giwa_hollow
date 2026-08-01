import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const tables = ["litvm_raffle_raffles","litvm_raffle_entries","litvm_raffle_prizes","litvm_raffle_winners","litvm_raffle_transactions","litvm_raffle_users","litvm_raffle_admin_logs","litvm_raffle_game_sessions","litvm_raffle_game_users"];
for (const t of tables) {
  const { count, error } = await supa.from(t).select("*", { count: "exact", head: true });
  console.log(`${t.padEnd(32)} ${error ? "ERR " + error.message : count}`);
}
