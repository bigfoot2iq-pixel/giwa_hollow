import { createPublicClient, http, getAddress, parseEventLogs, isAddress } from "viem";
import { giwaSepolia } from "@/lib/contracts";
import { THE_HOLLOW_GAME_ADDRESS, THE_HOLLOW_GAME_ABI } from "@/lib/contracts/theHollowGame";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

export type PaymentVerification = {
  ok: boolean;
  error?: string;
};

/**
 * Verify on-chain that `txHash` is a real, successful payToPlay payment made by
 * `wallet` to the TheHollowGame contract.
 *
 * Trust model: the contract enforces `msg.value >= playPrice` and only emits
 * PlayPurchased on success, so a mined tx to the contract with a PlayPurchased
 * event for `wallet` is sufficient proof of payment. Replay of a valid hash is
 * blocked separately by the UNIQUE constraint on game_sessions.tx_hash.
 */
export async function verifyPayment(
  txHash: string,
  wallet: string
): Promise<PaymentVerification> {
  // Cheap input validation before any RPC round-trip
  if (!TX_HASH_RE.test(txHash)) {
    return { ok: false, error: "Malformed transaction hash" };
  }
  if (!isAddress(wallet)) {
    return { ok: false, error: "Malformed wallet address" };
  }
  if (
    !THE_HOLLOW_GAME_ADDRESS ||
    getAddress(THE_HOLLOW_GAME_ADDRESS) === ZERO_ADDRESS
  ) {
    // Misconfiguration — fail closed rather than accept unverifiable payments
    return { ok: false, error: "Payment verification unavailable" };
  }

  const client = createPublicClient({
    chain: giwaSepolia,
    transport: http(process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL),
  });

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
  } catch {
    // Not found = not mined (yet) on this chain, or never existed
    return { ok: false, error: "Transaction not found on chain" };
  }

  if (receipt.status !== "success") {
    return { ok: false, error: "Transaction failed on chain" };
  }

  if (!receipt.to || getAddress(receipt.to) !== getAddress(THE_HOLLOW_GAME_ADDRESS)) {
    return { ok: false, error: "Transaction not sent to game contract" };
  }

  // Confirm a PlayPurchased event exists for this wallet. Parsing the event
  // (rather than trusting receipt.from) also covers payments relayed via an
  // intermediary while still binding the credited player to `wallet`.
  const logs = parseEventLogs({
    abi: THE_HOLLOW_GAME_ABI,
    eventName: "PlayPurchased",
    logs: receipt.logs,
  });

  const paidByWallet = logs.some(
    (log) => getAddress((log.args as { player: string }).player) === getAddress(wallet)
  );

  if (!paidByWallet) {
    return { ok: false, error: "No matching payment for this wallet" };
  }

  return { ok: true };
}
