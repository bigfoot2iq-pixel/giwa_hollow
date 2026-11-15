/**
 * Launchpad collection source data.
 *
 * The artwork is pinned to Pinata as two IPFS directories: one for the ERC-721
 * metadata JSON files and one for the PNG images. Both are proxied through this
 * app so the public contract/metadata never exposes the Pinata directory
 * listings or the original image CIDs.
 */

const DEFAULT_METADATA_CID =
  "bafybeib7obwtzah63c2suhhd4gozid5whvxis5q2u5ehlngrgca6r4r3m4";
const DEFAULT_IMAGE_CID =
  "bafybeidr4yey3n4sc44knh2hzprsf7mmpe6xkmrxyinfz3nzobrb6hlacq";
const DEFAULT_ART_SUPPLY = 2222;

export const LAUNCHPAD_METADATA_CID =
  process.env.LAUNCHPAD_METADATA_CID || DEFAULT_METADATA_CID;
export const LAUNCHPAD_IMAGE_CID =
  process.env.LAUNCHPAD_IMAGE_CID || DEFAULT_IMAGE_CID;
export const LAUNCHPAD_ART_SUPPLY = Number(
  process.env.LAUNCHPAD_ART_SUPPLY || DEFAULT_ART_SUPPLY
);

/** Base gateway, kept configurable for a dedicated Pinata gateway. */
export const PINATA_GATEWAY = (
  process.env.PINATA_GATEWAY_URL || "https://gateway.pinata.cloud"
).replace(/\/+$/, "");

export interface LaunchpadTokenMetadata {
  name?: string;
  description?: string;
  image?: string;
  [key: string]: unknown;
}

/**
 * The contract builds tokenURI as `${baseURI}${tokenId}.json`, so the route
 * receives "1.json". Image URLs use "1.png"; both forms are accepted.
 */
export function parseTokenId(raw: string): number | null {
  const match = /^(\d+)(?:\.(?:json|png))?$/.exec(raw);
  if (!match) return null;

  const tokenId = Number(match[1]);
  if (
    !Number.isSafeInteger(tokenId) ||
    tokenId < 1 ||
    tokenId > LAUNCHPAD_ART_SUPPLY
  ) {
    return null;
  }

  return tokenId;
}

export function getMetadataUrl(tokenId: number): string {
  return `${PINATA_GATEWAY}/ipfs/${LAUNCHPAD_METADATA_CID}/${tokenId}.json`;
}

export function getImageUrl(tokenId: number): string {
  return `${PINATA_GATEWAY}/ipfs/${LAUNCHPAD_IMAGE_CID}/${tokenId}.png`;
}

/**
 * Reads one token's metadata from Pinata. Metadata is immutable per token, so
 * the Next.js data cache absorbs repeat reads.
 */
export async function fetchTokenMetadata(
  tokenId: number
): Promise<LaunchpadTokenMetadata> {
  const response = await fetch(getMetadataUrl(tokenId), {
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `Pinata metadata for token ${tokenId} returned ${response.status}`
    );
  }

  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`Pinata metadata for token ${tokenId} is not an object`);
  }

  return data as LaunchpadTokenMetadata;
}

/**
 * Converts the metadata's `ipfs://<cid>/<path>` image into a gateway URL.
 * Only IPFS paths and the configured gateway are accepted so the proxy can
 * never be pointed at an arbitrary host.
 */
export function resolveImageUrl(image: unknown): string | null {
  if (typeof image !== "string" || !image.trim()) return null;

  if (image.startsWith("ipfs://")) {
    const path = image.slice("ipfs://".length).replace(/^ipfs\//, "");
    if (!/^[A-Za-z0-9]+\/.+$/.test(path)) return null;
    return `${PINATA_GATEWAY}/ipfs/${path}`;
  }

  if (image.startsWith(`${PINATA_GATEWAY}/ipfs/`)) {
    return image;
  }

  return null;
}
