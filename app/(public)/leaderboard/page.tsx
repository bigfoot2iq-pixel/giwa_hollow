'use client';

import { Suspense } from 'react';
import Leaderboard from '@/components/game/Leaderboard';

function LeaderboardLoading() {
  return (
    <div className="ui-container rounded-2xl overflow-hidden">
      <div className="p-12 text-center">
        <div className="inline-block w-8 h-8 border-4 border-black/20 border-t-accent-warm rounded-full animate-spin mb-4"></div>
        <p className="text-muted-blue">Loading leaderboard...</p>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Page Title */}
      <div className="mb-6 lg:mb-8">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-header text-foreground mb-2">Leaderboard</h2>
        <p className="text-muted-blue text-xs sm:text-sm">Top warriors ranked by their highest scores</p>
      </div>

      {/* Leaderboard */}
      <Suspense fallback={<LeaderboardLoading />}>
        <Leaderboard />
      </Suspense>
    </div>
  );
}
