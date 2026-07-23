import { createClient } from "@supabase/supabase-js";

/**
 * Script to find the chain_raffle_id for a raffle
 * Usage: npx tsx scripts/find-chain-raffle-id.ts [raffleTitle or dbId]
 */

async function findChainRaffleId(searchTerm: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`\n🔍 Searching for raffle: "${searchTerm}"\n`);

  try {
    // Try to search by ID first
    const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchTerm);
    
    let query = supabase
      .from("litvm_raffle_raffles")
      .select("id, title, chain_raffle_id, start_date, end_date, created_at");

    if (isId) {
      query = query.eq("id", searchTerm);
    } else {
      query = query.ilike("title", `%${searchTerm}%`);
    }

    const { data, error } = await query.order("created_at", { ascending: false }).limit(10);

    if (error) {
      console.error("❌ Error querying database:", error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log("❌ No raffles found matching:", searchTerm);
      console.log("\nTry searching by:");
      console.log("  - Raffle title (partial match works)");
      console.log("  - Database ID (UUID)\n");
      process.exit(1);
    }

    console.log(`✅ Found ${data.length} raffle(s):\n`);
    console.log("─────────────────────────────────────────────────────────────────────────────");

    data.forEach((raffle, index) => {
      console.log(`\n${index + 1}. ${raffle.title}`);
      console.log(`   Database ID:      ${raffle.id}`);
      console.log(`   Chain Raffle ID:  ${raffle.chain_raffle_id || "NOT SET"}`);
      console.log(`   Start Date:       ${new Date(raffle.start_date).toLocaleString()}`);
      console.log(`   End Date:         ${new Date(raffle.end_date).toLocaleString()}`);
      console.log(`   Created:          ${new Date(raffle.created_at).toLocaleString()}`);
      
      if (raffle.chain_raffle_id) {
        console.log(`\n   📝 To check state:    npx tsx scripts/check-raffle-state.ts ${raffle.chain_raffle_id}`);
        console.log(`   🔧 To activate:       npx tsx scripts/activate-raffle.ts ${raffle.chain_raffle_id}`);
      } else {
        console.log(`\n   ⚠️  WARNING: This raffle has no chain_raffle_id set!`);
        console.log(`      It may not have been created on-chain yet.`);
      }
    });

    console.log("\n─────────────────────────────────────────────────────────────────────────────\n");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

const searchTerm = process.argv[2];
if (!searchTerm) {
  console.error("Usage: npx tsx scripts/find-chain-raffle-id.ts <raffleTitle or dbId>");
  console.error("\nExamples:");
  console.error("  npx tsx scripts/find-chain-raffle-id.ts 'NFT Raffle'");
  console.error("  npx tsx scripts/find-chain-raffle-id.ts 12345678-1234-1234-1234-123456789abc");
  process.exit(1);
}

findChainRaffleId(searchTerm);
