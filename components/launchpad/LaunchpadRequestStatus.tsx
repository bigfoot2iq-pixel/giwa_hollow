"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import type { LaunchpadRequestStatus as RequestStatus } from "@/lib/supabase";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_META: Record<
  RequestStatus,
  { label: string; description: string; className: string }
> = {
  pending: {
    label: "Pending review",
    description:
      "We have your request. It is queued for review — there is nothing else you need to do right now.",
    className: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  reviewing: {
    label: "In review",
    description:
      "Our team is reviewing your collection details. We may reach out with a few questions.",
    className: "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  },
  approved: {
    label: "Approved",
    description:
      "Approved! We will use the contact details you provided to schedule the launch with you.",
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  rejected: {
    label: "Not approved",
    description:
      "This request was not approved. You are welcome to submit an updated request.",
    className: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-300",
  },
  launched: {
    label: "Launched",
    description:
      "This collection has launched. Head to the launchpad to see the live mint page.",
    className: "border-iris/20 bg-iris/10 text-iris-deep",
  },
};

interface StatusResult {
  id: string;
  collection_name: string;
  symbol: string;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy 'at' p");
}

export function LaunchpadRequestStatus({
  initialId = "",
}: {
  initialId?: string;
}) {
  const [requestId, setRequestId] = useState(initialId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StatusResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async (rawId: string) => {
    const id = rawId.trim();

    if (!id) {
      setResult(null);
      setError("Paste the request ID from your confirmation.");
      return;
    }

    if (!UUID_PATTERN.test(id)) {
      setResult(null);
      setError(
        "That doesn't look like a request ID. Copy the full ID from your confirmation, e.g. 8f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/launchpad/requests/${id.toLowerCase()}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok) {
        setResult(null);
        setError(data.error || "Could not check that request.");
        return;
      }

      setResult(data.request as StatusResult);
    } catch {
      setResult(null);
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialId.trim()) return;
    // Deferred one tick so the auto-check never sets state synchronously while
    // the component is mounting.
    queueMicrotask(() => {
      void check(initialId);
    });
  }, [initialId, check]);

  const meta = result ? STATUS_META[result.status] : null;

  return (
    <div className="ui-container rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Track a request</p>
          <h2 className="mt-2 font-header text-xl font-extrabold tracking-[-0.03em] text-ink sm:text-2xl">
            Check your request status
          </h2>
          <p className="mt-1 max-w-md text-[11px] leading-5 text-ink-mute">
            Paste the reference ID you received when you submitted your
            collection to see where it stands.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void check(requestId);
          }}
          className="flex w-full items-center gap-2 sm:w-auto sm:min-w-[26rem]"
        >
          <input
            value={requestId}
            onChange={(event) => setRequestId(event.target.value)}
            placeholder="8f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f"
            aria-label="Request ID"
            spellCheck={false}
            autoComplete="off"
            className="field h-[52px] flex-1 font-mono text-xs"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-iris shrink-0"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin text-lg">
                progress_activity
              </span>
            ) : (
              "Check"
            )}
          </button>
        </form>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[11px] leading-5 text-red-600 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {result && meta && (
        <div className="mt-4 rounded-2xl border border-ink/[0.08] bg-paper/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] ${meta.className}`}
            >
              {meta.label}
            </span>
            <p className="font-header text-lg font-extrabold tracking-[-0.02em] text-ink">
              {result.collection_name}
            </p>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
              {result.symbol}
            </span>
          </div>

          <p className="mt-2 text-[12px] leading-6 text-ink-soft">
            {meta.description}
          </p>

          <dl className="mt-4 grid gap-3 text-[11px] text-ink-mute sm:grid-cols-3">
            <div>
              <dt className="font-mono text-[9px] uppercase tracking-[0.14em]">
                Reference
              </dt>
              <dd className="mt-1 select-all break-all font-mono text-[10px] text-ink">
                {result.id}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[9px] uppercase tracking-[0.14em]">
                Submitted
              </dt>
              <dd className="mt-1 text-ink">{formatDate(result.created_at)}</dd>
            </div>
            <div>
              <dt className="font-mono text-[9px] uppercase tracking-[0.14em]">
                Last update
              </dt>
              <dd className="mt-1 text-ink">{formatDate(result.updated_at)}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
