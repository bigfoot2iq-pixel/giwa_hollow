"use client";

import { Suspense } from "react";
import Leaderboard from "@/components/game/Leaderboard";

function LeaderboardLoading() {
  return (
    <div className="ui-container overflow-hidden rounded-[26px]">
      <div className="p-12 text-center">
        <div className="mb-4 inline-block size-8 animate-spin rounded-full border-4 border-iris/15 border-t-iris" />
        <p className="text-sm text-ink-mute">Loading the leaderboard…</p>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <div className="page-shell">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">The pecking order</p>
          <h1 className="display mt-4 text-[clamp(2.2rem,5vw,3.6rem)] text-ink">
            Leaderboard
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-6 text-ink-soft">
            Ranked by ARIWA holdings and historical game scores. The quiet ones
            at the top are usually the ones who kept showing up.
          </p>
        </div>
        <span className="pill">
          <span className="live-dot" />
          live standings
        </span>
      </div>

      <div className="mt-8">
        <Suspense fallback={<LeaderboardLoading />}>
          <Leaderboard />
        </Suspense>
      </div>
    </div>
  );
}
