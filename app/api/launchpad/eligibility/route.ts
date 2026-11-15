import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  formatUnits,
  http,
  isAddress,
  parseUnits,
} from "viem";
import { createServiceClient } from "@/lib/supabase/server";
import { HOLDER_CHAINS, getHolderChainRpcUrl } from "@/lib/launchpad/chains";
import {
  HOLDER_REQUIREMENTS_CONFIG_KEY,
  parseHolderRequirements,
} from "@/lib/launchpad/config";

export const dynamic = "force-dynamic";

interface ChainResult {
  chain: string;
  label: string;
  symbol: string;
  minAmount: string;
  balance: string;
  meets: boolean;
  error: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawAddress = searchParams.get("address");

    if (!rawAddress || !isAddress(rawAddress)) {
      return NextResponse.json(
        { error: "A valid wallet address is required" },
        { status: 400 }
      );
    }

    const address = rawAddress as `0x${string}`;
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("litvm_raffle_config")
      .select("value")
      .eq("key", HOLDER_REQUIREMENTS_CONFIG_KEY)
      .maybeSingle();

    if (error) {
      console.error("Error reading launchpad holder requirements:", error);
      return NextResponse.json(
        { error: "Could not load holder requirements" },
        { status: 500 }
      );
    }

    const requirements = parseHolderRequirements(data?.value);

    if (requirements.length === 0) {
      return NextResponse.json(
        {
          eligible: true,
          gateEnabled: false,
          requirements: [],
          address,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const results: ChainResult[] = await Promise.all(
      requirements.map(async (requirement) => {
        const chain = HOLDER_CHAINS[requirement.chain];

        try {
          const client = createPublicClient({
            transport: http(getHolderChainRpcUrl(requirement.chain), {
              timeout: 10_000,
              retryCount: 1,
            }),
          });

          const balance = await client.getBalance({ address });
          const minimum = parseUnits(requirement.minAmount, chain.decimals);

          return {
            chain: requirement.chain,
            label: chain.label,
            symbol: chain.symbol,
            minAmount: requirement.minAmount,
            balance: formatUnits(balance, chain.decimals),
            meets: balance >= minimum,
            error: null,
          };
        } catch (err) {
          console.error(
            `Holder balance check failed for ${requirement.chain}:`,
            err
          );
          return {
            chain: requirement.chain,
            label: chain.label,
            symbol: chain.symbol,
            minAmount: requirement.minAmount,
            balance: "0",
            meets: false,
            error: "Balance check unavailable",
          };
        }
      })
    );

    return NextResponse.json(
      {
        eligible: results.some((result) => result.meets),
        gateEnabled: true,
        requirements: results,
        address,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error in GET /api/launchpad/eligibility:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
