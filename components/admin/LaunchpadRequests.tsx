"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  adminAuthHeaders,
  useAdminAuth,
} from "@/lib/hooks/useAdminAuth";
import type {
  LaunchpadRequest,
  LaunchpadRequestStatus,
} from "@/lib/supabase";

const STATUSES: LaunchpadRequestStatus[] = [
  "pending",
  "reviewing",
  "approved",
  "rejected",
  "launched",
];

const statusClass: Record<LaunchpadRequestStatus, string> = {
  pending: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  reviewing: "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  approved: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-300",
  launched: "border-iris/20 bg-iris/10 text-iris",
};

interface Draft {
  status: LaunchpadRequestStatus;
  admin_notes: string;
}

function shortAddress(value: string | null): string {
  if (!value) return "—";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function requestContact(request: LaunchpadRequest): string {
  return request.contact_email || (request.contact_x ? `@${request.contact_x}` : "—");
}

export function LaunchpadRequests() {
  const { getAdminAuth } = useAdminAuth();
  const [requests, setRequests] = useState<LaunchpadRequest[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupMigration, setSetupMigration] = useState<string | null>(null);
  const [filter, setFilter] = useState<LaunchpadRequestStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSetupMigration(null);

    try {
      const auth = await getAdminAuth();
      const response = await fetch("/api/admin/launchpad/requests", {
        headers: adminAuthHeaders(auth),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load launch requests");
      }

      if (data.setupRequired) {
        setSetupMigration(
          data.migration || "supabase/migrations/20261113_launchpad.sql"
        );
      }

      const loaded: LaunchpadRequest[] = data.requests || [];
      setRequests(loaded);
      setDrafts(
        Object.fromEntries(
          loaded.map((request) => [
            request.id,
            {
              status: request.status,
              admin_notes: request.admin_notes || "",
            },
          ])
        )
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load launch requests"
      );
    } finally {
      setLoading(false);
    }
  }, [getAdminAuth]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: requests.length };
    for (const status of STATUSES) {
      result[status] = requests.filter(
        (request) => request.status === status
      ).length;
    }
    return result;
  }, [requests]);

  const visibleRequests = useMemo(
    () =>
      filter === "all"
        ? requests
        : requests.filter((request) => request.status === filter),
    [filter, requests]
  );

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  };

  const saveRequest = async (id: string) => {
    const draft = drafts[id];
    if (!draft) return;

    setSavingId(id);

    try {
      const auth = await getAdminAuth();
      const response = await fetch(
        `/api/admin/launchpad/requests/${id}`,
        {
          method: "PATCH",
          headers: {
            ...adminAuthHeaders(auth),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draft),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update the request");
      }

      const updated = data.request as LaunchpadRequest;
      setRequests((current) =>
        current.map((request) => (request.id === id ? updated : request))
      );
      setDrafts((current) => ({
        ...current,
        [id]: {
          status: updated.status,
          admin_notes: updated.admin_notes || "",
        },
      }));
      toast.success("Request updated");
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : "Could not update the request"
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="ui-container rounded overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-6 py-4">
        <div>
          <h3 className="text-xl font-header text-text-primary">
            Launch requests
          </h3>
          <p className="mt-1 text-[11px] text-muted-blue">
            Community submissions from the public launchpad form.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded bg-ink/[0.04] p-1">
          {(["all", ...STATUSES] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                filter === status
                  ? "bg-accent-warm text-background"
                  : "text-muted-blue hover:text-text-primary"
              }`}
            >
              {status === "all" ? "All" : status}
              <span className="ml-1 opacity-60">({counts[status] ?? 0})</span>
            </button>
          ))}
        </div>
      </div>

      {setupMigration && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-amber-500/20 bg-amber-500/5 px-6 py-4">
          <div className="max-w-2xl">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
              Database setup required
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              The <code className="font-mono">litvm_launchpad_requests</code>{" "}
              table does not exist yet, so community submissions cannot be
              stored. Run{" "}
              <code className="font-mono text-xs">{setupMigration}</code> in the
              Supabase SQL editor, then retry.
            </p>
          </div>
          <button
            onClick={() => loadRequests()}
            className="rounded border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300 transition-all hover:bg-amber-500/20"
          >
            Retry
          </button>
        </div>
      )}

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-500/20 bg-red-500/5 px-6 py-4">
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          <button
            onClick={() => loadRequests()}
            className="rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-300 transition-all hover:bg-red-500/20"
          >
            Retry
          </button>
        </div>
      )}

      {setupMigration ? null : loading && requests.length === 0 ? (
        <div className="space-y-3 p-6">
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded bg-ink/[0.04]"
            />
          ))}
        </div>
      ) : visibleRequests.length === 0 ? (
        <div className="p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-muted-blue">
            inbox
          </span>
          <p className="mt-2 text-sm text-muted-blue">
            {filter === "all"
              ? "No launch requests yet."
              : `No ${filter} requests.`}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="border-b border-ink/10 bg-ink/[0.04]">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                  Collection
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                  Contact
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                  Launch
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {visibleRequests.map((request) => {
                const isExpanded = expandedId === request.id;
                const draft = drafts[request.id] || {
                  status: request.status,
                  admin_notes: request.admin_notes || "",
                };

                return (
                  <FragmentRow
                    key={request.id}
                    request={request}
                    draft={draft}
                    isExpanded={isExpanded}
                    saving={savingId === request.id}
                    onToggle={() =>
                      setExpandedId(isExpanded ? null : request.id)
                    }
                    onDraft={(patch) => updateDraft(request.id, patch)}
                    onSave={() => saveRequest(request.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  request,
  draft,
  isExpanded,
  saving,
  onToggle,
  onDraft,
  onSave,
}: {
  request: LaunchpadRequest;
  draft: Draft;
  isExpanded: boolean;
  saving: boolean;
  onToggle: () => void;
  onDraft: (patch: Partial<Draft>) => void;
  onSave: () => void;
}) {
  return (
    <>
      <tr className="transition-colors hover:bg-ink/[0.04]">
        <td className="px-6 py-5">
          <p className="font-bold text-text-primary">
            {request.collection_name}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-muted-blue">
            {request.symbol} · {request.supply.toLocaleString()} supply
          </p>
          <p
            className="mt-1 font-mono text-[9px] text-muted-blue"
            title={request.id}
          >
            ID {request.id.slice(0, 8)}
          </p>
        </td>
        <td className="px-6 py-5">
          <p className="text-sm text-text-primary">{requestContact(request)}</p>
          <p className="font-mono text-[10px] text-muted-blue">
            {shortAddress(request.creator_wallet)}
          </p>
        </td>
        <td className="px-6 py-5">
          <p className="text-sm text-text-primary">
            {format(new Date(request.launch_date), "MMM d, yyyy")}
          </p>
          <p className="text-[10px] text-muted-blue">
            {format(new Date(request.launch_date), "p")}
          </p>
        </td>
        <td className="px-6 py-5">
          <span
            className={`rounded border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClass[request.status]}`}
          >
            {request.status}
          </span>
        </td>
        <td className="px-6 py-5 text-right">
          <button
            onClick={onToggle}
            className="rounded border border-ink/10 bg-paper px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04]"
          >
            {isExpanded ? "Close" : "Review"}
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={5} className="bg-ink/[0.02] px-6 py-6">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                    Description
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
                    {request.description}
                  </p>
                </div>

                {request.notes && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                      Extra notes
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
                      {request.notes}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                    Links
                  </p>
                  <div className="mt-2 space-y-1.5 text-xs">
                    {[
                      { label: "Website", url: request.website_url },
                      { label: "X", url: request.x_url },
                      { label: "Discord", url: request.discord_url },
                      { label: "Artwork", url: request.artwork_url },
                    ]
                      .filter((link) => !!link.url)
                      .map((link) => (
                        <p key={link.label} className="text-muted-blue">
                          {link.label}:{" "}
                          <span className="select-all break-all font-mono text-text-primary">
                            {link.url}
                          </span>
                        </p>
                      ))}
                    {!request.website_url &&
                      !request.x_url &&
                      !request.discord_url &&
                      !request.artwork_url && (
                        <p className="text-xs text-muted-blue">No links.</p>
                      )}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                    Reference ID
                  </p>
                  <p className="mt-1 select-all break-all font-mono text-xs text-text-primary">
                    {request.id}
                  </p>
                </div>

                <div className="grid gap-3 text-xs text-muted-blue sm:grid-cols-2">
                  <p>
                    Mint price:{" "}
                    <span className="font-bold text-text-primary">
                      {request.mint_price} ETH
                    </span>
                  </p>
                  <p>
                    Submitted:{" "}
                    <span className="font-bold text-text-primary">
                      {format(new Date(request.created_at), "MMM d, yyyy p")}
                    </span>
                  </p>
                  <p>
                    Chain:{" "}
                    <span className="font-bold text-text-primary">
                      {request.chain}
                    </span>
                  </p>
                  <p>
                    Wallet:{" "}
                    <span className="font-mono text-text-primary">
                      {request.creator_wallet || "—"}
                    </span>
                  </p>
                  <p>
                    Email:{" "}
                    <span className="font-bold text-text-primary">
                      {request.contact_email || "—"}
                    </span>
                  </p>
                  <p>
                    X:{" "}
                    <span className="font-bold text-text-primary">
                      {request.contact_x ? `@${request.contact_x}` : "—"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-ink/10 bg-paper p-4">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                    Status
                  </span>
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      onDraft({
                        status: event.target.value as LaunchpadRequestStatus,
                      })
                    }
                    className="w-full rounded border border-ink/10 bg-paper px-3 py-2.5 text-sm text-text-primary focus:border-iris/50 focus:outline-none"
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                    Admin notes
                  </span>
                  <textarea
                    rows={5}
                    value={draft.admin_notes}
                    onChange={(event) =>
                      onDraft({ admin_notes: event.target.value })
                    }
                    placeholder="Internal notes, follow-up steps…"
                    className="w-full rounded border border-ink/10 bg-paper px-3 py-2.5 text-sm text-text-primary placeholder:text-ink/30 focus:border-iris/50 focus:outline-none"
                  />
                </label>

                <button
                  onClick={onSave}
                  disabled={saving}
                  className="w-full rounded-full bg-accent-warm px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-background transition-all hover:brightness-110 disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save request"}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
