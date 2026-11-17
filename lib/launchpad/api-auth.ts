import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSignature } from "@/lib/utils/auth";
import { getAppOrigin } from "./storage";
import {
  UPLOAD_TOKEN_HEADER,
  verifyUploadToken,
  type UploadTokenPayload,
} from "./upload-token";

export function jsonError(
  message: string,
  status: number,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    { error: message, ...extra },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function requireAdmin(
  request: NextRequest
): Promise<{ wallet: string } | { response: NextResponse }> {
  const ok = await verifyAdminSignature(request);
  if (!ok) return { response: jsonError("Unauthorized", 401) };

  const wallet = request.headers.get("x-admin-wallet")?.toLowerCase() || "";
  return { wallet };
}

export async function requireUploadToken(
  request: NextRequest,
  expectedVersion?: string
): Promise<{ payload: UploadTokenPayload } | { response: NextResponse }> {
  let payload: UploadTokenPayload | null;

  try {
    payload = await verifyUploadToken(request.headers.get(UPLOAD_TOKEN_HEADER));
  } catch (error) {
    console.error("Upload token verification is not configured:", error);
    return {
      response: jsonError(
        "Upload sessions are not configured on this deployment",
        500
      ),
    };
  }

  if (!payload) {
    return { response: jsonError("Upload session expired or invalid", 401) };
  }

  if (expectedVersion && payload.version !== expectedVersion) {
    return {
      response: jsonError("Upload session does not match this version", 403),
    };
  }

  return { payload };
}

export function appOrigin(request: NextRequest): string {
  return getAppOrigin(request.nextUrl.origin);
}
