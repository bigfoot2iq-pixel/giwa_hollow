/**
 * Types shared by the admin upload client and the storage API routes.
 *
 * Keep this file free of server-only imports so the client component can use
 * the same shapes as the route handlers.
 */

export type ImageExtension = "png" | "jpg" | "jpeg" | "webp" | "gif" | "avif";

/** The mutable pointer that decides which private version the public routes serve. */
export interface ActiveCollection {
  schema: "ariwa-launchpad-active/1";
  collection: string;
  version: string;
  supply: number;
  imageExtension: ImageExtension;
  activatedAt: string;
  activatedBy: string;
  previousVersion: string | null;
}

/** Immutable receipt written by the finalize step for one version. */
export interface CollectionRecord {
  schema: "ariwa-launchpad-collection/1";
  collection: string;
  version: string;
  name: string;
  description: string;
  supply: number;
  imageExtension: ImageExtension;
  imageCount: number;
  metadataCount: number;
  totalBytes: number;
  contentHash: string;
  createdAt: string;
  createdBy: string;
}

export interface ManifestFileEntry {
  key: string;
  bytes: number;
  contentType: string;
  etag: string | null;
}

export interface ManifestFile {
  tokenId: number;
  image: ManifestFileEntry;
  metadata: ManifestFileEntry;
}

export interface VersionManifest {
  schema: "ariwa-launchpad-manifest/1";
  collection: string;
  version: string;
  supply: number;
  imageExtension: ImageExtension;
  contentHash: string;
  files: ManifestFile[];
  createdAt: string;
  createdBy: string;
}

export interface VersionSummary {
  version: string;
  complete: boolean;
  active: boolean;
  imageCount: number;
  metadataCount: number;
  totalBytes: number;
  record?: CollectionRecord;
  /** Token ids already present, only returned for the pending version. */
  imageIds?: number[];
  metadataIds?: number[];
}

export interface StorageStatusResponse {
  supply: number;
  collection: string;
  active: ActiveCollection | null;
  versions: VersionSummary[];
  pending: VersionSummary | null;
  legacy: {
    metadataCid: string;
    imageCid: string;
    gateway: string;
  };
}

export interface UploadSessionResponse {
  version: string;
  token: string;
  expiresAt: string;
  supply: number;
  active: ActiveCollection | null;
  uploadedImageIds: number[];
  uploadedMetadataIds: number[];
  /** True when the requested version is already finalized. */
  complete: boolean;
}

export interface FinalizeReport {
  version: string;
  record: CollectionRecord;
  manifestKey: string;
  contentHash: string;
  imageCount: number;
  metadataCount: number;
  totalBytes: number;
}
