import {
  LAUNCHPAD_ART_SUPPLY,
  LEGACY_IMAGE_CID,
  LEGACY_METADATA_CID,
  LEGACY_PINATA_GATEWAY,
} from "./constants";
import {
  getNftBucket,
  metadataKey,
  parseTokenId,
  readActiveCollection,
} from "./storage";
import type { ActiveCollection } from "./storage-types";

/**
 * Launchpad source resolution.
 *
 * Artwork and metadata live in a private R2 bucket. `active.json` picks the
 * published version. Until an R2 version is activated, the old Pinata
 * directories remain a read-only fallback so deploying this code cannot break
 * the live collection.
 */

export { LAUNCHPAD_ART_SUPPLY, parseTokenId };
export const LAUNCHPAD_METADATA_CID = LEGACY_METADATA_CID;
export const LAUNCHPAD_IMAGE_CID = LEGACY_IMAGE_CID;
export const PINATA_GATEWAY = LEGACY_PINATA_GATEWAY;

export type LaunchpadSource =
  | { kind: "r2"; active: ActiveCollection }
  | { kind: "pinata"; metadataCid: string; imageCid: string };

export interface LaunchpadTokenMetadata {
  name?: string;
  description?: string;
  image?: string;
  [key: string]: unknown;
}

export interface ResolvedTokenMetadata {
  metadata: LaunchpadTokenMetadata;
  source: LaunchpadSource;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export async function resolveLaunchpadSource(): Promise<LaunchpadSource> {
  try {
    const active = await readActiveCollection();
    if (active) return { kind: "r2", active };
  } catch (error) {
    // A missing binding or a corrupt pointer must not take the live collection
    // down; fall back to the legacy gateway until an admin re-activates.
    console.error(
      "Failed to read the active R2 launchpad collection; falling back to Pinata:",
      error
    );
  }

  return {
    kind: "pinata",
    metadataCid: LAUNCHPAD_METADATA_CID,
    imageCid: LAUNCHPAD_IMAGE_CID,
  };
}

/**
 * Gateways tried in order for the legacy Pinata content. Pinata's gateway
 * rate-limits shared egress (including the Worker's), so public gateways are
 * kept as a temporary fallback until an R2 version is activated.
 */
const LEGACY_GATEWAY_BASES = Array.from(
  new Set([
    PINATA_GATEWAY,
    // Pinata rate-limits shared egress, including Workers. Filebase's public
    // gateway serves the same IPFS content and has been reliable from GIWA's
    // Worker egress; the other public gateways are kept as a last resort.
    "https://ipfs.filebase.io",
    "https://ipfs.io",
    "https://dweb.link",
  ])
);

export function getLegacyMetadataUrls(tokenId: number): string[] {
  return LEGACY_GATEWAY_BASES.map(
    (base) => `${base}/ipfs/${LAUNCHPAD_METADATA_CID}/${tokenId}.json`
  );
}

export function getLegacyImageUrls(tokenId: number): string[] {
  return LEGACY_GATEWAY_BASES.map(
    (base) => `${base}/ipfs/${LAUNCHPAD_IMAGE_CID}/${tokenId}.png`
  );
}

export async function fetchLegacyTokenMetadata(
  tokenId: number
): Promise<LaunchpadTokenMetadata> {
  let lastError: Error | null = null;

  for (const url of getLegacyMetadataUrls(tokenId)) {
    try {
      const response = await fetch(url, {
        // Legacy metadata is immutable; the Next data cache absorbs repeat reads.
        next: { revalidate: 86_400 },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        lastError = new Error(
          `Legacy metadata for token ${tokenId} returned ${response.status}`
        );
        continue;
      }

      const data: unknown = await response.json();
      if (!isRecord(data)) {
        lastError = new Error(
          `Legacy metadata for token ${tokenId} is not an object`
        );
        continue;
      }

      return data as LaunchpadTokenMetadata;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(`Legacy metadata for token ${tokenId} failed`);
    }
  }

  throw lastError || new Error(`Legacy metadata for token ${tokenId} failed`);
}

export async function fetchTokenMetadata(
  tokenId: number
): Promise<ResolvedTokenMetadata> {
  const source = await resolveLaunchpadSource();

  if (source.kind === "pinata") {
    return {
      metadata: await fetchLegacyTokenMetadata(tokenId),
      source,
    };
  }

  const bucket = await getNftBucket();
  const object = await bucket.get(metadataKey(source.active.version, tokenId));

  if (!object) {
    throw new Error(
      `R2 metadata for token ${tokenId} (${source.active.version}) is missing`
    );
  }

  const data = await object.json<unknown>();
  if (!isRecord(data)) {
    throw new Error(`R2 metadata for token ${tokenId} is not an object`);
  }

  return { metadata: data as LaunchpadTokenMetadata, source };
}
