"use client";

import { useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";

export interface AdminAuth {
  wallet: string;
  signature: string;
  timestamp: string;
}

const AUTH_TTL_MS = 5 * 60 * 1000;

/**
 * Module-level so every admin surface (launchpad requests, raffles table,
 * maintenance toggles) shares one signature prompt instead of asking the
 * wallet to sign again on each tab.
 */
const authCache = new Map<string, AdminAuth>();
const pendingAuth = new Map<string, Promise<AdminAuth>>();

/**
 * Shared admin signature helper. Caches a signature for five minutes and
 * coalesces concurrent requests so a page load only prompts the wallet once.
 * The message format must match `verifyAdminSignature` in lib/utils/auth.ts.
 */
export function useAdminAuth() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const walletLower = address?.toLowerCase();

  const getAdminAuth = useCallback(async (): Promise<AdminAuth> => {
    if (!walletLower) {
      throw new Error("Wallet not connected");
    }

    const now = Date.now();
    const cached = authCache.get(walletLower);
    if (cached && now - Number(cached.timestamp) < AUTH_TTL_MS) {
      return cached;
    }

    const pending = pendingAuth.get(walletLower);
    if (pending) {
      return pending;
    }

    const timestamp = now.toString();
    const message = `GIWA Raffles Admin\nTimestamp: ${timestamp}`;

    const promise = signMessageAsync({ message })
      .then((signature) => {
        const auth = { wallet: walletLower, signature, timestamp };
        authCache.set(walletLower, auth);
        pendingAuth.delete(walletLower);
        return auth;
      })
      .catch((error) => {
        pendingAuth.delete(walletLower);
        throw error;
      });

    pendingAuth.set(walletLower, promise);
    return promise;
  }, [walletLower, signMessageAsync]);

  return {
    address,
    wallet: walletLower,
    getAdminAuth,
  };
}

export function adminAuthHeaders(auth: AdminAuth): Record<string, string> {
  return {
    "x-admin-wallet": auth.wallet,
    "x-admin-signature": auth.signature,
    "x-admin-timestamp": auth.timestamp,
  };
}
