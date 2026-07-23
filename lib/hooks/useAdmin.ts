"use client";

import { useEffect, useRef, useState } from "react";

export function useAdminStatus(wallet: string | undefined) {
  const walletLower = wallet?.toLowerCase();
  const [adminWallet, setAdminWallet] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const pendingWalletRef = useRef<string | null>(null);
  const pendingRequestRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (!walletLower || walletLower === adminWallet) {
      return;
    }

    let isActive = true;

    const request =
      pendingRequestRef.current && pendingWalletRef.current === walletLower
        ? pendingRequestRef.current
        : (() => {
            console.info("[AdminAccess] Checking wallet", walletLower);
            const pending = fetch(`/api/admin/access?wallet=${encodeURIComponent(walletLower)}`)
              .then(async (response) => {
                if (!response.ok) {
                  console.warn("[AdminAccess] Access check failed", response.status);
                  return false;
                }
                const data = await response.json();
                return Boolean(data?.isAdmin);
              })
              .finally(() => {
                if (pendingWalletRef.current === walletLower) {
                  pendingWalletRef.current = null;
                  pendingRequestRef.current = null;
                }
              });

            pendingWalletRef.current = walletLower;
            pendingRequestRef.current = pending;
            return pending;
          })();

    request
      .then((admin) => {
        if (isActive) {
          console.info("[AdminAccess] Access result", { wallet: walletLower, isAdmin: admin });
          setAdminWallet(walletLower);
          setIsAdmin(admin);
        }
      })
      .catch((error) => {
        if (isActive) {
          console.error("[AdminAccess] Access check error", error);
          setAdminWallet(walletLower);
          setIsAdmin(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [walletLower, adminWallet]);

  const isLoading = Boolean(walletLower && walletLower !== adminWallet);

  return { isAdmin: walletLower === adminWallet ? isAdmin : false, isLoading };
}
