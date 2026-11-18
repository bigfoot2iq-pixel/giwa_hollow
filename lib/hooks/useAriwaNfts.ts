"use client";

import { useQuery } from "@tanstack/react-query";

export interface AriwaNft {
  id: number;
  name: string;
  image: string;
}

interface AriwaNftsPayload {
  nfts: AriwaNft[];
  count: number;
  contract: string;
}

async function fetchAriwaNfts(address: string): Promise<AriwaNftsPayload> {
  const response = await fetch(
    `/api/profile/nfts?wallet=${encodeURIComponent(address)}`,
    {
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error || "Could not load your ARIWA NFTs.");
  }

  const payload = (await response.json()) as unknown;

  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as AriwaNftsPayload).nfts)
  ) {
    throw new Error("The collection response was not readable.");
  }

  return payload as AriwaNftsPayload;
}

/**
 * Reads the connected wallet's ARIWA NFTs. The server route resolves the
 * ERC721A collection through the explorer, so the client only deals with token
 * ids and image URLs. A minute of staleness is invisible on a profile screen and
 * keeps the explorer request count low.
 */
export function useAriwaNfts(address: string | undefined) {
  const query = useQuery({
    queryKey: ["ariwa-nfts", address?.toLowerCase()],
    queryFn: () => fetchAriwaNfts(address as string),
    enabled: Boolean(address),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  return {
    nfts: query.data?.nfts ?? [],
    count: query.data?.count ?? 0,
    contract: query.data?.contract ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    isRefetching: query.isRefetching,
    error: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
  };
}
