import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import { normalizeHttpUrl } from "@/lib/launchpad/url";
import { createServiceClient } from "@/lib/supabase/server";
import {
  isMissingTableError,
  LAUNCHPAD_REQUESTS_MIGRATION,
  LAUNCHPAD_REQUESTS_TABLE,
} from "@/lib/supabase/errors";

export const dynamic = "force-dynamic";

const optionalUrl = z
  .union([z.string().max(500), z.null(), z.undefined()])
  .transform((value, ctx) => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return null;

    const normalized = normalizeHttpUrl(trimmed);
    if (!normalized) {
      ctx.addIssue("Enter a valid link, e.g. https://example.com");
      return null;
    }
    return normalized;
  });

const requestSchema = z
  .object({
    collection_name: z.string().trim().min(2).max(120),
    symbol: z
      .string()
      .trim()
      .min(2)
      .max(16)
      .regex(/^[A-Za-z0-9]+$/, "Symbol may only contain letters and numbers"),
    description: z.string().trim().min(20).max(2000),
    supply: z.number().int().positive().max(1_000_000),
    mint_price: z
      .string()
      .trim()
      .regex(/^(?:\d+\.?\d*|\.\d+)$/, "Invalid mint price"),
    launch_date: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid launch date"),
    creator_wallet: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(
        (value) => !value || isAddress(value),
        "Invalid creator wallet"
      ),
    contact_email: z
      .string()
      .trim()
      .max(320)
      .optional()
      .nullable()
      .transform((value) => (value ? value : null))
      .refine(
        (value) => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        "Invalid email"
      ),
    contact_x: z
      .string()
      .trim()
      .max(100)
      .optional()
      .nullable()
      .transform((value) => (value ? value.replace(/^@/, "") : null)),
    website_url: optionalUrl,
    x_url: optionalUrl,
    discord_url: optionalUrl,
    artwork_url: optionalUrl,
    notes: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .nullable()
      .transform((value) => (value ? value : null)),
    // Honeypot: real users never fill this hidden field.
    company_website: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.contact_email && !data.contact_x) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contact_email"],
        message: "Add an email or an X handle so we can reach you",
      });
    }

    if (new Date(data.launch_date).getTime() < Date.now() - 60_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["launch_date"],
        message: "Launch date must be in the future",
      });
    }
  });

// In-memory throttle. Serverless instances reset it, but it stops casual spam
// from a single warm instance without adding another dependency.
const lastSubmissionByIp = new Map<string, number>();
const SUBMISSION_COOLDOWN_MS = 60_000;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const lastSubmission = lastSubmissionByIp.get(ip) || 0;
    if (Date.now() - lastSubmission < SUBMISSION_COOLDOWN_MS) {
      return NextResponse.json(
        { error: "Please wait a minute before sending another request" },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Please check the form",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    if (data.company_website) {
      // Honeypot tripped — pretend it worked so bots do not retry.
      return NextResponse.json({ success: true, id: null });
    }

    lastSubmissionByIp.set(ip, Date.now());

    const supabase = await createServiceClient();
    const { data: inserted, error, status } = await supabase
      .from("litvm_launchpad_requests")
      .insert({
        collection_name: data.collection_name,
        symbol: data.symbol.toUpperCase(),
        description: data.description,
        chain: "giwa-sepolia",
        supply: data.supply,
        mint_price: data.mint_price,
        launch_date: new Date(data.launch_date).toISOString(),
        creator_wallet: data.creator_wallet?.toLowerCase() || null,
        contact_email: data.contact_email,
        contact_x: data.contact_x,
        website_url: data.website_url,
        x_url: data.x_url,
        discord_url: data.discord_url,
        artwork_url: data.artwork_url,
        notes: data.notes,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      if (isMissingTableError(error, status)) {
        console.warn(
          `[launchpad] table "${LAUNCHPAD_REQUESTS_TABLE}" is missing - apply ${LAUNCHPAD_REQUESTS_MIGRATION} in the Supabase SQL editor`
        );
        return NextResponse.json(
          {
            error:
              "Launch requests are temporarily unavailable. Please try again later.",
          },
          { status: 503 }
        );
      }

      console.error("Error creating launchpad request:", error);
      return NextResponse.json(
        { error: "Could not save the request. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, id: inserted.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/launchpad/requests:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
