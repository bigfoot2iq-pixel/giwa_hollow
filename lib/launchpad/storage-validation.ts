import { IMAGE_CONTENT_TYPES } from "./constants";
import type { ImageExtension } from "./storage-types";

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

/** Reject renamed HTML/SVG files before they reach the public image route. */
export function matchesImageMagic(
  bytes: Uint8Array,
  ext: ImageExtension
): boolean {
  switch (ext) {
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
    case "jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "gif":
      return startsWith(bytes, [0x47, 0x49, 0x46, 0x38]);
    case "webp":
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        bytes.length >= 12 &&
        ascii(bytes, 8, 12) === "WEBP"
      );
    case "avif":
      return (
        bytes.length >= 12 &&
        ascii(bytes, 4, 8) === "ftyp" &&
        (ascii(bytes, 8, 12) === "avif" || ascii(bytes, 8, 12) === "avis")
      );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export class MetadataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetadataValidationError";
  }
}

/**
 * Validate a HashLips/ERC-721 metadata object and point `image` at the public
 * proxy. Every other field (dna, edition, date, attributes, compiler, ...) is
 * preserved exactly as supplied.
 */
export function normalizeMetadata(
  metadata: unknown,
  tokenId: number,
  imageUrl: string
): Record<string, unknown> {
  if (!isRecord(metadata)) {
    throw new MetadataValidationError("Metadata must be a JSON object");
  }

  const name = metadata.name;
  if (typeof name !== "string" || !name.trim()) {
    throw new MetadataValidationError("Metadata name must be a non-empty string");
  }

  if (
    metadata.description !== undefined &&
    typeof metadata.description !== "string"
  ) {
    throw new MetadataValidationError("Metadata description must be a string");
  }

  if (
    metadata.edition !== undefined &&
    Number(metadata.edition) !== tokenId
  ) {
    throw new MetadataValidationError(
      `Metadata edition must match token ${tokenId}`
    );
  }

  if (
    metadata.attributes !== undefined &&
    !Array.isArray(metadata.attributes)
  ) {
    throw new MetadataValidationError("Metadata attributes must be an array");
  }

  const animation = metadata.animation_url;
  if (
    typeof animation === "string" &&
    (animation.startsWith("ipfs://") || animation.includes("/ipfs/"))
  ) {
    throw new MetadataValidationError(
      "IPFS animation_url values are not supported by the image proxy yet"
    );
  }

  return { ...metadata, image: imageUrl };
}

export function contentTypeForImage(ext: ImageExtension): string {
  return IMAGE_CONTENT_TYPES[ext];
}
