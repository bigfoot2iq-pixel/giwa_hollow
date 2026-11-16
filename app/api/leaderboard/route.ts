import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { LeaderboardResponse, LeaderboardEntry } from '@/lib/supabase/types';
import { CACHE } from '@/lib/utils/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsedPage = parseInt(searchParams.get('page') || '1', 10);
    const parsedLimit = parseInt(searchParams.get('limit') || '10', 10);
    const page = Number.isFinite(parsedPage) ? Math.max(parsedPage, 1) : 1;
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 50)
      : 10; // Cap at 50
    const offset = (page - 1) * limit;

    const supabase = await createServiceClient();

    // Call the database function to get leaderboard data
    const { data, error } = await supabase
      .rpc('litvm_raffle_get_leaderboard', {
        limit_count: limit,
        offset_count: offset
      });

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard' },
        { status: 500 }
      );
    }

    // Transform the data to match our interface
    interface LeaderboardRow {
      rank: number | string;
      wallet_address: string;
      username: string | null;
      is_registered: boolean;
      image_url: string | null;
      x_avatar_url: string | null;
      game_score: number;
      total_count: number | string;
    }

    const rows = (data ?? []) as LeaderboardRow[];

    const leaderboardEntries: LeaderboardEntry[] = rows.map((row) => ({
      rank: parseInt(String(row.rank)),
      wallet_address: row.wallet_address,
      username: row.is_registered ? (row.username ?? 'Anonymous') : 'Anonymous',
      avatar_url: row.is_registered 
        ? (row.image_url || row.x_avatar_url) 
        : null,
      image_url: row.is_registered ? row.image_url : null,
      x_avatar_url: row.is_registered ? row.x_avatar_url : null,
      game_score: row.game_score,
      is_registered: row.is_registered
    }));

    const total = rows.length > 0 ? parseInt(String(rows[0].total_count)) : 0;
    const hasMore = offset + limit < total;

    const response: LeaderboardResponse = {
      data: leaderboardEntries,
      total,
      page,
      limit,
      hasMore
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': CACHE.leaderboard },
    });
  } catch (error) {
    console.error('Error in leaderboard API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 