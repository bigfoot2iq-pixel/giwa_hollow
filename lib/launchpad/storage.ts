import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  IMAGE_CONTENT_TYPES,
  LAUNCHPAD_COLLECTION,
  LAUNCHPAD_ART_SUPPLY,
} from "./constants";
import type {
  ActiveCollection,
  CollectionRecord,
  ImageExtension,
} from "./storage-types";

/**
 * Minimal structural types for the R2 binding.
 *
 * The generated `cloudflare-env.d.ts` is gitignored, so keeping the subset we
 * use here avoids a build that depends on running `wrangler types` first. The
 * real binding satisfies this shape.
 */
export interface NftObject {
  key: string;
  size: number;
  etag: string;
  httpEtag?: string;
  uploaded: Date;
  httpMetadata?: {
    contentType?: string;
  };
}

export interface NftObjectBody extends NftObject {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
}

export interface NftListResult {
  objects: NftObject[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes: string[];
}

export interface NftPutOptions {
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    contentLanguage?: string;
  };
  customMetadata?: Record<string, string>;
}

export interface NftBucket {
  get(
    key: string,
    options?: { range?: { offset: number; length: number } }
  ): Promise<NftObjectBody | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: NftPutOptions
  ): Promise<NftObject | null>;
  list(options?: {
    prefix?: string;
    delimiter?: string;
    cursor?: string;
    limit?: number;
  }): Promise<NftListResult>;
  delete(keys: string | string[]): Promise<void>;
}

export const STORAGE_ROOT = "launchpad";
export const ACTIVE_KEY = `${STORAGE_ROOT}/active.json`;
export const COLLECTION_PREFIX = `${STORAGE_ROOT}/${LAUNCHPAD_COLLECTION}`;

const VERSION_PATTERN = /^v[1-9]\d{0,3}$/;
const ACTIVE_CACHE_MS = 15_000;

let activeCache: { value: ActiveCollection | null; at: number } | null = null;

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigurationError";
  }
}

export async function getNftBucket(): Promise<NftBucket> {
  const { env } = await getCloudflareContext({ async: true });
  const bucket = (env as unknown as { NFT_BUCKET?: NftBucket }).NFT_BUCKET;

  if (!bucket) {
    throw new StorageConfigurationError(
      "NFT_BUCKET is not configured. Add the R2 binding to wrangler.jsonc and redeploy."
    );
  }

  return bucket;
}

export function isValidVersion(value: unknown): value is string {
  return typeof value === "string" && VERSION_PATTERN.test(value);
}

export function assertVersion(value: unknown): asserts value is string {
  if (!isValidVersion(value)) {
    throw new Error("Invalid version. Expected v1, v2, ...");
  }
}

export function versionPrefix(version: string): string {
  assertVersion(version);
  return `${COLLECTION_PREFIX}/${version}/`;
}

export function imageKey(
  version: string,
  tokenId: number,
  ext: ImageExtension
): string {
  return `${versionPrefix(version)}images/${tokenId}.${ext}`;
}

export function metadataKey(version: string, tokenId: number): string {
  return `${versionPrefix(version)}metadata/${tokenId}.json`;
}

export function manifestKey(version: string): string {
  return `${versionPrefix(version)}manifest.json`;
}

export function collectionKey(version: string): string {
  return `${versionPrefix(version)}collection.json`;
}

export function imagePrefix(version: string): string {
  return `${versionPrefix(version)}images/`;
}

export function metadataPrefix(version: string): string {
  return `${versionPrefix(version)}metadata/`;
}

export function isTokenId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= LAUNCHPAD_ART_SUPPLY
  );
}

export function parseTokenId(raw: string): number | null {
  const match = /^(\d+)(?:\.([a-z0-9]+))?$/i.exec(raw);
  if (!match) return null;

  const tokenId = Number(match[1]);
  if (!isTokenId(tokenId)) return null;

  const ext = match[2]?.toLowerCase();
  if (ext && ext !== "json" && !(ext in IMAGE_CONTENT_TYPES)) return null;

  return tokenId;
}

export function parseImageObjectName(
  relative: string
): { tokenId: number; ext: ImageExtension } | null {
  const match = /^(\d+)\.([a-z0-9]+)$/i.exec(relative);
  if (!match) return null;

  const tokenId = Number(match[1]);
  const ext = match[2].toLowerCase();
  if (!isTokenId(tokenId) || !(ext in IMAGE_CONTENT_TYPES)) return null;

  return { tokenId, ext: ext as ImageExtension };
}

export function parseMetadataObjectName(relative: string): number | null {
  const match = /^(\d+)\.json$/i.exec(relative);
  if (!match) return null;

  const tokenId = Number(match[1]);
  return isTokenId(tokenId) ? tokenId : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseActiveCollection(value: unknown): ActiveCollection {
  if (!isRecord(value)) {
    throw new Error("active.json is not an object");
  }

  const version = value.version;
  const supply = value.supply;
  const imageExtension = value.imageExtension;

  if (
    value.schema !== "ariwa-launchpad-active/1" ||
    value.collection !== LAUNCHPAD_COLLECTION ||
    !isValidVersion(version) ||
    typeof supply !== "number" ||
    !Number.isSafeInteger(supply) ||
    supply < 1 ||
    typeof imageExtension !== "string" ||
    !(imageExtension in IMAGE_CONTENT_TYPES)
  ) {
    throw new Error("active.json is missing required fields");
  }

  return {
    schema: "ariwa-launchpad-active/1",
    collection: LAUNCHPAD_COLLECTION,
    version,
    supply,
    imageExtension: imageExtension as ImageExtension,
    activatedAt:
      typeof value.activatedAt === "string" ? value.activatedAt : "",
    activatedBy:
      typeof value.activatedBy === "string" ? value.activatedBy : "",
    previousVersion:
      typeof value.previousVersion === "string" ? value.previousVersion : null,
  };
}

export async function readActiveCollection(
  force = false
): Promise<ActiveCollection | null> {
  if (
    !force &&
    activeCache &&
    Date.now() - activeCache.at < ACTIVE_CACHE_MS
  ) {
    return activeCache.value;
  }

  const bucket = await getNftBucket();
  const object = await bucket.get(ACTIVE_KEY);
  const value = object ? parseActiveCollection(await object.json()) : null;

  activeCache = { value, at: Date.now() };
  return value;
}

export function invalidateActiveCollectionCache(): void {
  activeCache = null;
}

export async function writeActiveCollection(
  record: ActiveCollection
): Promise<void> {
  const bucket = await getNftBucket();
  await bucket.put(ACTIVE_KEY, JSON.stringify(record, null, 2), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl: "no-store",
    },
  });
  activeCache = { value: record, at: Date.now() };
}

function parseCollectionRecord(
  value: unknown,
  version: string
): CollectionRecord {
  if (!isRecord(value)) {
    throw new Error(`collection.json for ${version} is not an object`);
  }

  if (
    value.schema !== "ariwa-launchpad-collection/1" ||
    value.collection !== LAUNCHPAD_COLLECTION ||
    value.version !== version
  ) {
    throw new Error(`collection.json for ${version} does not match`);
  }

  return value as unknown as CollectionRecord;
}

export async function readCollectionRecord(
  version: string
): Promise<CollectionRecord | null> {
  const bucket = await getNftBucket();
  const object = await bucket.get(collectionKey(version));
  if (!object) return null;
  return parseCollectionRecord(await object.json(), version);
}

export async function writeCollectionRecord(
  record: CollectionRecord
): Promise<void> {
  const bucket = await getNftBucket();
  await bucket.put(collectionKey(record.version), JSON.stringify(record, null, 2), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
}

export async function listVersionNames(): Promise<string[]> {
  const bucket = await getNftBucket();
  const prefix = `${COLLECTION_PREFIX}/`;
  const versions = new Set<string>();
  let cursor: string | undefined;

  do {
    const page = await bucket.list({ prefix, delimiter: "/", cursor });
    for (const delimited of page.delimitedPrefixes) {
      const tail = delimited.slice(prefix.length).replace(/\/$/, "");
      if (isValidVersion(tail)) versions.add(tail);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return [...versions].sort(compareVersions);
}

export function compareVersions(a: string, b: string): number {
  return Number(a.slice(1)) - Number(b.slice(1));
}

export async function nextVersionName(): Promise<string> {
  const versions = await listVersionNames();
  const highest = versions.reduce((max, version) => {
    const value = Number(version.slice(1));
    return value > max ? value : max;
  }, 0);

  return `v${highest + 1}`;
}

export async function listObjects(prefix: string): Promise<NftObject[]> {
  const bucket = await getNftBucket();
  const objects: NftObject[] = [];
  let cursor: string | undefined;

  do {
    const page = await bucket.list({ prefix, cursor });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return objects;
}

export async function listImageObjects(
  version: string
): Promise<NftObject[]> {
  return listObjects(imagePrefix(version));
}

export async function listMetadataObjects(
  version: string
): Promise<NftObject[]> {
  return listObjects(metadataPrefix(version));
}

export async function listTokenIds(
  version: string,
  kind: "images" | "metadata"
): Promise<number[]> {
  const prefix = kind === "images" ? imagePrefix(version) : metadataPrefix(version);
  const objects = await listObjects(prefix);
  const ids = new Set<number>();

  for (const object of objects) {
    const relative = object.key.slice(prefix.length);
    const tokenId =
      kind === "images"
        ? parseImageObjectName(relative)?.tokenId
        : parseMetadataObjectName(relative);
    if (tokenId) ids.add(tokenId);
  }

  return [...ids].sort((a, b) => a - b);
}

export async function deleteVersionObjects(version: string): Promise<number> {
  const bucket = await getNftBucket();
  const objects = await listObjects(versionPrefix(version));
  let deleted = 0;

  for (let index = 0; index < objects.length; index += 100) {
    const batch = objects.slice(index, index + 100);
    await bucket.delete(batch.map((object) => object.key));
    deleted += batch.length;
  }

  return deleted;
}

export function getAppOrigin(fallbackOrigin: string): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  return (configured || fallbackOrigin).replace(/\/+$/, "");
}

export function publicImageUrl(
  origin: string,
  tokenId: number,
  ext: ImageExtension,
  version: string
): string {
  return `${origin}/api/launchpad/image/${tokenId}.${ext}?v=${version}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
