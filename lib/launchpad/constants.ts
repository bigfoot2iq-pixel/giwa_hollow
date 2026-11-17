/**
 * Shared launchpad storage constants.
 *
 * The public launchpad is a single ARIWA Genesis collection. Artwork and
 * metadata are stored in a private R2 bucket and served exclusively through
 * the /api/launchpad routes, so the storage origin is never exposed.
 */

export const LAUNCHPAD_COLLECTION =
  process.env.LAUNCHPAD_COLLECTION || "ariwa-genesis";

export const DEFAULT_ART_SUPPLY = 2222;

export const LAUNCHPAD_ART_SUPPLY = Number(
  process.env.LAUNCHPAD_ART_SUPPLY || DEFAULT_ART_SUPPLY
);

/**
 * Legacy Pinata source. Kept as a read-only fallback until an R2 version has
 * been activated; the old gateway URLs are the rollback for the migration.
 *
 * The metadata directory holds `<id>.json` files. Their `image` fields point
 * at the artwork directory below, which holds `<id>.png` files. Both CIDs stay
 * server-side: the contract only ever sees this app's `/api/launchpad/*` URLs.
 */
export const LEGACY_METADATA_CID =
  process.env.LAUNCHPAD_METADATA_CID ||
  "bafybeiaur5jmgea7fqpcetz5jy6xpdwllxk5dbfpzfogyxx2qsuj2d65ya";

export const LEGACY_IMAGE_CID =
  process.env.LAUNCHPAD_IMAGE_CID ||
  "bafybeifilzk37k2xxp6l7n3zuc46y2jukvsm4whh25iroexgffttpgowpm";

export const LEGACY_PINATA_GATEWAY = (
  process.env.PINATA_GATEWAY_URL || "https://gateway.pinata.cloud"
).replace(/\/+$/, "");

/**
 * Cache-busting token for the IPFS-backed image proxy.
 *
 * Public metadata rewrites `image` to `/api/launchpad/image/<id>.png`; without
 * a suffix, switching folders would leave explorers serving the previous
 * artwork from their long-lived image cache. The suffix only changes when the
 * image directory does, and deliberately contains no gateway or full CID.
 */
export const LEGACY_IMAGE_VERSION = `legacy-${LEGACY_IMAGE_CID.slice(-8)}`;

/** Maximum image size accepted by the admin upload and the public proxy. */
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

import type { ImageExtension } from "./storage-types";

export const IMAGE_EXTENSIONS: readonly ImageExtension[] = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "avif",
];

export const IMAGE_CONTENT_TYPES: Record<ImageExtension, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

export const IMAGE_EXTENSION_ALIASES: Record<string, ImageExtension> = {
  png: "png",
  jpg: "jpg",
  jpeg: "jpeg",
  webp: "webp",
  gif: "gif",
  avif: "avif",
};

export function isImageExtension(value: string): value is ImageExtension {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(value);
}

/** The extension used in a public image URL for a stored extension. */
export function publicImageExtension(ext: ImageExtension): ImageExtension {
  // Keep the original spelling so /1.jpg and /1.jpeg are distinct keys, but
  // both serve image/jpeg.
  return ext;
}
