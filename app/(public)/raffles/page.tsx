import { RafflesExplorer } from "@/components/raffle/RafflesExplorer";
import { RafflesMaintenance } from "@/components/raffle/RafflesMaintenance";
import { createServiceClient } from "@/lib/supabase/server";
import { RAFFLES_MAINTENANCE_CONFIG_KEY } from "@/lib/launchpad/config";

export const dynamic = "force-dynamic";

async function isRafflesMaintenance(): Promise<boolean> {
  try {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from("litvm_raffle_config")
      .select("value")
      .eq("key", RAFFLES_MAINTENANCE_CONFIG_KEY)
      .maybeSingle();

    if (!data) return true;
    return data.value !== "false";
  } catch (error) {
    // If config can't be read, keep the safer maintenance view.
    console.error("Error reading raffles maintenance flag:", error);
    return true;
  }
}

export default async function RafflesPage() {
  if (await isRafflesMaintenance()) {
    return <RafflesMaintenance />;
  }

  return (
    <RafflesExplorer
      title="Raffles Explorer"
      emptyHint="Check back soon for new raffles!"
    />
  );
}
