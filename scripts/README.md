# Raffle Management Scripts

Scripts for debugging and managing raffles on GIWA Sepolia.

## Prerequisites

All scripts require environment variables in `.env.local`:

```bash
# Required for all scripts
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_RPC_URL=https://sepolia-rpc.giwa.io

# Required for activation script only
WATCHDOG_PRIVATE_KEY=0x...
# OR
ADMIN_PRIVATE_KEY=0x...
```

## Scripts

### 1. Find Chain Raffle ID

Find the on-chain raffle ID from the database.

```bash
npx tsx scripts/find-chain-raffle-id.ts <searchTerm>
```

**Examples:**
```bash
# Search by title
npx tsx scripts/find-chain-raffle-id.ts "NFT Raffle"

# Search by database ID
npx tsx scripts/find-chain-raffle-id.ts 12345678-1234-1234-1234-123456789abc
```

**Output:**
```
✅ Found 1 raffle(s):

1. Epic NFT Raffle
   Database ID:      12345678-1234-1234-1234-123456789abc
   Chain Raffle ID:  42
   Start Date:       2/9/2026, 11:00:00 AM
   End Date:         2/16/2026, 11:00:00 AM
   Created:          2/8/2026, 10:30:00 AM

   📝 To check state:    npx tsx scripts/check-raffle-state.ts 42
   🔧 To activate:       npx tsx scripts/activate-raffle.ts 42
```

### 2. Check Raffle State

Check the current on-chain state of a raffle.

```bash
npx tsx scripts/check-raffle-state.ts <chainRaffleId>
```

**Example:**
```bash
npx tsx scripts/check-raffle-state.ts 42
```

**Output:**
```
📊 Raffle Details:
─────────────────────────────────────
Prize Type:    1 (NFT)
Prize Token:   0x1234...5678
Prize Count:   1
State:         0 (CREATED)
Has Winners:   false
─────────────────────────────────────

⚠️  WARNING: Raffle is in CREATED state!
   Users cannot join until it's activated.

   To fix: Call activateRaffle(42) from owner/watchdog wallet

isRaffleActive(): false
```

**Possible States:**
- `0` - CREATED (needs activation)
- `1` - ACTIVE (users can join)
- `2` - COMPLETED (raffle ended)
- `3` - CANCELLED (raffle cancelled)

### 3. Activate Raffle

Activate a raffle that's in CREATED state.

```bash
npx tsx scripts/activate-raffle.ts <chainRaffleId>
```

**Requirements:**
- `WATCHDOG_PRIVATE_KEY` or `ADMIN_PRIVATE_KEY` in `.env.local`
- The wallet must be authorized (owner or watchdog)

**Example:**
```bash
npx tsx scripts/activate-raffle.ts 42
```

**Output:**
```
🔧 Activating raffle #42
   Contract: 0xEa4072a2D9961983E8FaFc3165D06BDcE6093DC5
   From: 0xD6De...aB89a

📝 Sending activateRaffle transaction...
   Transaction hash: 0xd885...6763
   Waiting for confirmation...

✅ Raffle activated successfully!
   Block: 23936123
   Gas used: 45123

   New state: 1 (ACTIVE)
```

## Common Workflows

### Workflow 1: User Reports "Invalid raffle state" Error

1. Find the chain raffle ID:
   ```bash
   npx tsx scripts/find-chain-raffle-id.ts "Raffle Title"
   ```

2. Check the current state:
   ```bash
   npx tsx scripts/check-raffle-state.ts <chainRaffleId>
   ```

3. If state is CREATED, activate it:
   ```bash
   npx tsx scripts/activate-raffle.ts <chainRaffleId>
   ```

4. Verify activation:
   ```bash
   npx tsx scripts/check-raffle-state.ts <chainRaffleId>
   ```

### Workflow 2: Verify New Raffle After Creation

1. Find the raffle:
   ```bash
   npx tsx scripts/find-chain-raffle-id.ts "New Raffle"
   ```

2. Check its state:
   ```bash
   npx tsx scripts/check-raffle-state.ts <chainRaffleId>
   ```

3. If it should be active but isn't, activate it:
   ```bash
   npx tsx scripts/activate-raffle.ts <chainRaffleId>
   ```

### Workflow 3: Bulk Check All Recent Raffles

```bash
# Get all recent raffles
npx tsx scripts/find-chain-raffle-id.ts ""

# Check each one
npx tsx scripts/check-raffle-state.ts 1
npx tsx scripts/check-raffle-state.ts 2
npx tsx scripts/check-raffle-state.ts 3
```

## Troubleshooting

### "Raffle not found" Error

The raffle doesn't exist on-chain. Check:
- Is the `chain_raffle_id` correct?
- Was the raffle created on-chain successfully?
- Are you connected to the right network?

### "Not authorized" Error

Your wallet doesn't have permission. Check:
- Is `WATCHDOG_PRIVATE_KEY` or `ADMIN_PRIVATE_KEY` set?
- Is the wallet the owner or watchdog of the contract?
- Is the private key correct?

### "Raffle is not in CREATED state"

The raffle is already active or completed. No action needed.

### "Transaction failed"

Check:
- Does the wallet have enough ETH for gas?
- Is the RPC URL correct?
- Is the network congested?

## Contract Reference

**Contract Address:** `0xEa4072a2D9961983E8FaFc3165D06BDcE6093DC5`

**Key Functions:**
- `raffles(uint256)` - Get raffle details
- `getRaffleState(uint256)` - Get raffle state
- `isRaffleActive(uint256)` - Check if active
- `activateRaffle(uint256)` - Activate raffle (owner/watchdog only)

**States:**
```solidity
enum RaffleState {
    CREATED,    // 0 - Needs activation
    ACTIVE,     // 1 - Users can join
    COMPLETED,  // 2 - Raffle ended
    CANCELLED   // 3 - Raffle cancelled
}
```

## Development

To add new scripts:

1. Create a new `.ts` file in `scripts/`
2. Import necessary dependencies
3. Add usage instructions in comments
4. Update this README

Example template:
```typescript
/**
 * Script description
 * Usage: npx tsx scripts/my-script.ts <args>
 */

async function myScript(arg: string) {
  // Implementation
}

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: npx tsx scripts/my-script.ts <arg>");
  process.exit(1);
}

myScript(arg);
```
