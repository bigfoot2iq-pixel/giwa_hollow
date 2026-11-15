"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useConfig } from "@/lib/hooks";
import { RAFFLES_MAINTENANCE_CONFIG_KEY } from "@/lib/launchpad/config";

export function RafflesMaintenanceToggle() {
  const {
    value,
    fetchConfig,
    updateConfig,
    isLoading,
    error,
  } = useConfig(RAFFLES_MAINTENANCE_CONFIG_KEY, "true");

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const maintenance = value !== "false";

  const handleToggle = async () => {
    const next = maintenance ? "false" : "true";
    const saved = await updateConfig(next);

    if (saved) {
      toast.success(
        next === "true"
          ? "Raffles page set to maintenance"
          : "Raffles page is live again"
      );
    } else {
      toast.error(error || "Could not update the raffles page");
    }
  };

  return (
    <div className="flex items-center gap-3 rounded border border-ink/10 bg-ink/[0.03] px-4 py-2">
      <span className="material-symbols-outlined text-base text-iris">
        construction
      </span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-primary">
          Raffles page
        </p>
        <p className="text-[10px] text-muted-blue">
          {maintenance ? "Showing maintenance screen" : "Live"}
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`ml-auto rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-40 ${
          maintenance
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25"
            : "bg-orange-500/15 text-orange-700 dark:text-orange-300 hover:bg-orange-500/25"
        }`}
      >
        {isLoading ? "…" : maintenance ? "Go live" : "Set maintenance"}
      </button>
    </div>
  );
}
