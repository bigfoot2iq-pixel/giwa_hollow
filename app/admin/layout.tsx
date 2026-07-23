"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useAdminStatus } from "@/lib/hooks";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { isAdmin, isLoading } = useAdminStatus(isConnected ? address : undefined);

  useEffect(() => {
    if (isConnected && !isLoading && !isAdmin) {
      console.warn("[AdminAccess] Unauthorized redirect", { address, isAdmin, isLoading });
      router.push("/");
    }
  }, [address, isConnected, isLoading, isAdmin, router]);

  if (!isConnected) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Admin Access Required</h1>
        <p className="text-muted-blue">
          Please connect the admin wallet to access this area
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Checking Access</h1>
        <p className="text-muted-blue">Verifying admin permissions...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Unauthorized</h1>
        <p className="text-muted-blue">
          Your wallet is not authorized to access the admin area
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
