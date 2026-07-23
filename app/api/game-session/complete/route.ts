import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase/game-client';
import type { ScoreUpdateResponse } from '@/lib/supabase/types';
import { verifyScoreSignature, isScorePlausible } from '@/lib/utils/scoreAuth';

// POST - Complete game session and update high score (merged endpoint)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, walletAddress, score, signature } = body;

    // Validate input
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Valid session ID is required' },
        { status: 400 }
      );
    }

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json(
        { error: 'Valid wallet address is required' },
        { status: 400 }
      );
    }

    if (typeof score !== 'number' || score < 0 || !Number.isFinite(score)) {
      return NextResponse.json(
        { error: 'Valid score is required (must be non-negative number)' },
        { status: 400 }
      );
    }

    if (!signature || typeof signature !== 'string') {
      return NextResponse.json(
        { error: 'Score signature is required' },
        { status: 400 }
      );
    }

    // Auth: the score submission must be signed by the wallet that owns it.
    // Stops anyone replaying a (publicly readable) sessionId to post a score
    // for another player.
    const sigValid = await verifyScoreSignature({ walletAddress, sessionId, score, signature });
    if (!sigValid) {
      return NextResponse.json(
        { error: 'Invalid score signature' },
        { status: 401 }
      );
    }

    // Plausibility: reject scores impossible for the session's elapsed time.
    // Reads the immutable created_at of THIS session (not client-supplied).
    const { data: sessionRow, error: sessionErr } = await supabase
      .from('litvm_raffle_game_sessions')
      .select('created_at')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !sessionRow) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (!isScorePlausible(score, sessionRow.created_at)) {
      return NextResponse.json(
        { error: 'Score failed plausibility check' },
        { status: 400 }
      );
    }

    // Complete session and update score atomically
    const { data, error } = await supabase.rpc('litvm_raffle_complete_game_session', {
      p_session_id: sessionId,
      p_user_wallet: walletAddress,
      p_final_score: score
    });

    if (error) {
      console.error('Error completing game session:', error);
      return NextResponse.json(
        { error: 'Failed to complete game session' },
        { status: 500 }
      );
    }

    const result = data as {
      success: boolean;
      session_completed?: boolean;
      score_updated?: boolean;
      final_score?: number;
      high_score?: number;
      rank?: number;
      message?: string;
      error?: string;
      status?: string;
    };

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to complete session' },
        { status: 400 }
      );
    }

    // Return response compatible with existing ScoreUpdateResponse
    const response: ScoreUpdateResponse & { 
      sessionCompleted: boolean;
      finalScore: number;
    } = {
      success: true,
      updated: result.score_updated || false,
      current_score: result.high_score || 0,
      rank: result.rank,
      message: result.message || 'Session completed',
      sessionCompleted: result.session_completed || false,
      finalScore: result.final_score || 0
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in game-session/complete POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
