import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { createServiceClient } from "@/lib/supabase/server";
import { findGameUser } from "@/lib/utils/gameUsersServer";
import { verifyProfileSignature } from "@/lib/utils/profileAuth";

const AVATAR_BUCKET = "litvm-raffle-avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_USERNAME_LENGTH = 32;

function avatarFileNameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/");
    const bucketIndex = parts.indexOf(AVATAR_BUCKET);
    if (bucketIndex === -1 || bucketIndex === parts.length - 1) return null;
    return decodeURIComponent(parts.slice(bucketIndex + 1).join("/"));
  } catch {
    return null;
  }
}

// GET - read a profile. Returns { user: null } when the wallet has never
// registered, so the client can prompt for registration without creating a row.
export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet");

    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const user = await findGameUser(supabase, wallet);

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error in GET /api/game-user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH - create/update the profile. Requires a fresh wallet signature over
// (wallet, username, timestamp) so only the wallet owner can write its row.
export async function PATCH(request: NextRequest) {
  try {
    const formData = await request.formData();

    const wallet = String(formData.get("wallet") ?? "");
    const username = String(formData.get("username") ?? "").trim();
    const timestamp = Number(formData.get("timestamp"));
    const signature = String(formData.get("signature") ?? "");
    const removeImage = formData.get("removeImage") === "true";
    const image = formData.get("image");

    if (!isAddress(wallet)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    if (!username || username.length > MAX_USERNAME_LENGTH) {
      return NextResponse.json(
        { error: `Username must be between 1 and ${MAX_USERNAME_LENGTH} characters` },
        { status: 400 }
      );
    }

    const signatureValid = await verifyProfileSignature({
      walletAddress: wallet,
      username,
      timestamp,
      signature,
    });

    if (!signatureValid) {
      return NextResponse.json({ error: "Invalid or expired profile signature" }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Resolve or create the row. Creation only happens behind a valid
    // signature for this wallet, so it can no longer be spammed anonymously.
    let user = await findGameUser(supabase, wallet);
    if (!user) {
      const { data: created, error: createError } = await supabase
        .from("litvm_raffle_game_users")
        .insert({ wallet_address: getAddress(wallet), wallet_type: "evm" })
        .select()
        .single();

      if (createError) {
        // A concurrent request may have created it first; re-read before failing.
        user = await findGameUser(supabase, wallet);
        if (!user) {
          console.error("Error creating game user:", createError);
          return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
        }
      } else {
        user = created;
      }
    }

    // Defensive: the row must exist from here on.
    if (!user) {
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }

    // Image handling. `undefined` means "keep the current avatar".
    let imageUrl: string | null | undefined = undefined;
    const oldFileName = user.image_url ? avatarFileNameFromUrl(user.image_url) : null;

    if (image instanceof File && image.size > 0) {
      if (image.size > MAX_AVATAR_BYTES) {
        return NextResponse.json({ error: "Image must be less than 2MB" }, { status: 400 });
      }
      if (!image.type.startsWith("image/")) {
        return NextResponse.json({ error: "File must be an image" }, { status: 400 });
      }

      const extension =
        image.type === "image/png" ? "png" : image.type === "image/gif" ? "gif" : "jpg";
      const fileName = `${user.wallet_address}_${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(fileName, Buffer.from(await image.arrayBuffer()), {
          contentType: image.type,
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error("Error uploading avatar:", uploadError);
        return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 });
      }

      const { data: publicUrlData } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(fileName);
      imageUrl = publicUrlData.publicUrl;

      if (oldFileName) {
        await supabase.storage.from(AVATAR_BUCKET).remove([oldFileName]);
      }
    } else if (removeImage) {
      imageUrl = null;
      if (oldFileName) {
        await supabase.storage.from(AVATAR_BUCKET).remove([oldFileName]);
      }
    }

    const updateData: Record<string, unknown> = {
      username,
      is_registered: true,
    };
    if (imageUrl !== undefined) {
      updateData.image_url = imageUrl;
    }

    const { data: updated, error: updateError } = await supabase
      .from("litvm_raffle_game_users")
      .update(updateData)
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating game user:", updateError);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("Error in PATCH /api/game-user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
