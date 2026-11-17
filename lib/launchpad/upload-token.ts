import { getCloudflareContext } from "@opennextjs/cloudflare";
import { LAUNCHPAD_COLLECTION } from "./constants";

/**
 * Short-lived upload sessions.
 *
 * Verifying the admin wallet signature on every one of the 2,222 image PUTs
 * would mean 2,222 Supabase lookups and would trip the 60/min admin auth
 * limiter. The admin signs once, the server issues this HMAC token, and the
 * upload routes verify the token locally.
 */

export const UPLOAD_TOKEN_HEADER = "x-upload-token";

const TOKEN_VERSION = 1;
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

export interface UploadTokenPayload {
  v: 1;
  collection: string;
  version: string;
  wallet: string;
  exp: number;
}

export class UploadTokenConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadTokenConfigurationError";
  }
}

async function getSecret(): Promise<string> {
  const fromProcess = process.env.UPLOAD_TOKEN_SECRET?.trim();
  if (fromProcess) return fromProcess;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const fromEnv = (
      env as unknown as { UPLOAD_TOKEN_SECRET?: string }
    ).UPLOAD_TOKEN_SECRET?.trim();
    if (fromEnv) return fromEnv;
  } catch {
    // Fall through to the configuration error below.
  }

  throw new UploadTokenConfigurationError(
    "UPLOAD_TOKEN_SECRET is not configured. Set it with `wrangler secret put UPLOAD_TOKEN_SECRET` for production and in .env.local for local dev."
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createUploadToken(
  input: Omit<UploadTokenPayload, "v" | "exp" | "collection"> & {
    collection?: string;
    ttlMs?: number;
  }
): Promise<{ token: string; expiresAt: string }> {
  const payload: UploadTokenPayload = {
    v: TOKEN_VERSION,
    collection: input.collection || LAUNCHPAD_COLLECTION,
    version: input.version,
    wallet: input.wallet.toLowerCase(),
    exp: Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS),
  };

  const body = toBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await importKey(await getSecret()),
    new TextEncoder().encode(body)
  );

  return {
    token: `${body}.${toBase64Url(new Uint8Array(signature))}`,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export async function verifyUploadToken(
  token: string | null | undefined
): Promise<UploadTokenPayload | null> {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0 || separator === token.length - 1) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await importKey(await getSecret()),
      fromBase64Url(signature),
      new TextEncoder().encode(body)
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(body))
    ) as UploadTokenPayload;

    if (
      payload.v !== TOKEN_VERSION ||
      payload.collection !== LAUNCHPAD_COLLECTION ||
      typeof payload.version !== "string" ||
      typeof payload.wallet !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp <= Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
