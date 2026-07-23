"use client";

import { useState, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";

export function useConfig(key: string, initialValue: string = "0") {
  const [value, setValue] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const fetchConfig = useCallback(async () => {
    if (!key) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/config?key=${encodeURIComponent(key)}`);
      if (!response.ok) {
        console.error("Config fetch failed:", response.status);
        return;
      }
      const text = await response.text();
      if (!text) {
        console.error("Empty response from config API");
        return;
      }
      const data = JSON.parse(text);
      if (data.value !== undefined) {
        setValue(data.value);
      }
    } catch (err) {
      console.error("Error fetching config:", err);
    } finally {
      setIsLoading(false);
    }
  }, [key]);

  const updateConfig = useCallback(async (newValue: string) => {
    if (!key || !address || !isConnected) {
      setError("Wallet not connected");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const timestamp = Date.now().toString();
      const message = `GIWA Raffles Admin\nTimestamp: ${timestamp}`;
      const signature = await signMessageAsync({ message });

      const response = await fetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-wallet": address,
          "x-admin-signature": signature,
          "x-admin-timestamp": timestamp,
        },
        body: JSON.stringify({ key, value: newValue }),
      });

      const text = await response.text();
      if (!text) {
        setError("Empty response from server");
        return false;
      }
      
      const data = JSON.parse(text);
      if (response.ok) {
        setValue(data.value);
        return true;
      } else {
        setError(data.error || "Failed to update config");
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update config";
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [key, address, isConnected, signMessageAsync]);

  return {
    value,
    setValue,
    isLoading,
    error,
    fetchConfig,
    updateConfig,
  };
}
