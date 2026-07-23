import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase/game-client';
import type { LeaderboardResponse, LeaderboardEntry } from '@/lib/supabase/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50); // Cap at 50
    const offset = (page - 1) * limit;

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
    const leaderboardEntries: LeaderboardEntry[] = data.map((row: any) => ({
      rank: parseInt(row.rank),
      wallet_address: row.wallet_address,
      username: row.is_registered ? row.username : 'Anonymous',
      avatar_url: row.is_registered 
        ? (row.image_url || row.x_avatar_url) 
        : null,
      image_url: row.is_registered ? row.image_url : null,
      x_avatar_url: row.is_registered ? row.x_avatar_url : null,
      game_score: row.game_score,
      is_registered: row.is_registered
    }));

    const total = data.length > 0 ? parseInt(data[0].total_count) : 0;
    const hasMore = offset + limit < total;

    const response: LeaderboardResponse = {
      data: leaderboardEntries,
      total,
      page,
      limit,
      hasMore
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in leaderboard API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 