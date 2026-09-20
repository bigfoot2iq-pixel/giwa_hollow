import { getAddress, isAddress } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TheAriwaUser } from "@/lib/supabase/types";

/**
 * Server-only helpers for `litvm_raffle_game_users`.
 *
 * Wallet addresses were historically stored with whatever case the row was
 * created with (the wagmi checksummed form). Legacy SQL functions compare
 * `wallet_address = <arg>` case-sensitively, so the rule is:
 *   - resolve rows case-insensitively with `findGameUser`,
 *   - hand the *stored* `wallet_address` back to those SQL functions,
 *   - create new rows with the checksummed form.
 */

export function walletCandidates(wallet: string): string[] {
  const candidates = new Set<string>([wallet, wallet.toLowerCase()]);
  if (isAddress(wallet)) candidates.add(getAddress(wallet));
  return [...candidates];
}

export async function findGameUser(
  supabase: SupabaseClient,
  wallet: string
): Promise<TheAriwaUser | null> {
  const { data, error } = await supabase
    .from("litvm_raffle_game_users")
    .select("*")
    .in("wallet_address", walletCandidates(wallet))
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  return (data?.[0] as TheAriwaUser) ?? null;
}

/**
 * Resolve a wallet's profile, creating the row if it does not exist yet.
 * Only server-side (service-role) callers should use this — the anon RPC is
 * revoked once the write lockdown migration is applied.
 */
export async function ensureGameUser(
  supabase: SupabaseClient,
  wallet: string
): Promise<TheAriwaUser> {
  const existing = await findGameUser(supabase, wallet);
  if (existing) return existing;

  const { data, error } = await supabase.rpc("upsert_litvm_raffle_game_user", {
    wallet: getAddress(wallet),
    wallet_type: "evm",
  });

  if (error) throw error;
  return data as TheAriwaUser;
}
