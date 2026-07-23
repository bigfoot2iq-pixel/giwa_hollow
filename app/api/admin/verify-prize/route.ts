import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSignature } from "@/lib/utils/auth";
import { verifyERC20Token, verifyERC721Token } from "@/lib/utils/tokenVerification";
import { isAddress } from "viem";
import { z } from "zod";

const isUintString = (value: string) => /^\d+$/.test(value);

const verifyPrizeSchema = z.object({
  prize_type: z.enum(["erc20", "erc721", "erc6220"]),
  prize_token_address: z
    .string()
    .refine((value) => isAddress(value, { strict: false }), { message: "Invalid address" }),
  prize_amounts: z.array(z.string()).optional(),
  prize_token_ids: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSignature(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = verifyPrizeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error.issues },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Get admin wallet address from request headers
    const adminWallet = request.headers.get("x-admin-wallet");
    if (!adminWallet || !isAddress(adminWallet, { strict: false })) {
      return NextResponse.json(
        { error: "Invalid admin wallet address" },
        { status: 400 }
      );
    }

    if (data.prize_type === "erc20") {
      // Verify ERC20 token
      if (!data.prize_amounts || data.prize_amounts.length === 0) {
        return NextResponse.json(
          { error: "Prize amounts are required for ERC20 tokens" },
          { status: 400 }
        );
      }

      // Validate all amounts are valid uint strings
      const invalidAmounts = data.prize_amounts.filter((amount) => !isUintString(amount));
      if (invalidAmounts.length > 0) {
        return NextResponse.json(
          { error: "All prize amounts must be valid numbers" },
          { status: 400 }
        );
      }

      const totalAmount = data.prize_amounts.reduce(
        (sum, amount) => sum + BigInt(amount),
        0n
      );

      const result = await verifyERC20Token(
        data.prize_token_address,
        totalAmount,
        adminWallet
      );

      if (!result.isValid) {
        return NextResponse.json(
          {
            isValid: false,
            error: result.error,
            details: result.details,
          },
          { status: 200 }
        );
      }

      return NextResponse.json({
        isValid: true,
        message: "ERC20 token verified successfully",
        details: {
          ...result.details,
          ownerAddress: adminWallet,
        },
      });
    } else {
      // Verify ERC721/ERC6220 NFT
      if (!data.prize_token_ids || data.prize_token_ids.length === 0) {
        return NextResponse.json(
          { error: "Token IDs are required for NFT prizes" },
          { status: 400 }
        );
      }

      // Validate all token IDs are valid uint strings
      const invalidTokenIds = data.prize_token_ids.filter((id) => !isUintString(id));
      if (invalidTokenIds.length > 0) {
        return NextResponse.json(
          { error: "All token IDs must be valid numbers" },
          { status: 400 }
        );
      }

      const tokenIds = data.prize_token_ids.map((id) => BigInt(id));

      const result = await verifyERC721Token(
        data.prize_token_address,
        tokenIds,
        adminWallet
      );

      if (!result.isValid) {
        return NextResponse.json(
          {
            isValid: false,
            error: result.error,
            details: result.details,
          },
          { status: 200 }
        );
      }

      return NextResponse.json({
        isValid: true,
        message: "NFT verified successfully",
        details: {
          ...result.details,
          ownerAddress: adminWallet,
        },
      });
    }
  } catch (error) {
    console.error("Error in POST /api/admin/verify-prize:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
