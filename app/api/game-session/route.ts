import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase/game-client';
import { verifyPayment } from '@/lib/utils/verifyPayment';

// POST - Create a new game session after payment verification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, txHash } = body;

    // Validate input
    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json(
        { error: 'Valid wallet address is required' },
        { status: 400 }
      );
    }

    if (!txHash || typeof txHash !== 'string') {
      return NextResponse.json(
        { error: 'Valid transaction hash is required' },
        { status: 400 }
      );
    }

    // On-chain verification: confirm the tx is a real, successful payToPlay
    // payment from this wallet to the game contract before granting a session.
    const verification = await verifyPayment(txHash, walletAddress);
    if (!verification.ok) {
      return NextResponse.json(
        { error: verification.error || 'Payment verification failed' },
        { status: 400 }
      );
    }

    // Create game session
    const { data, error } = await supabase.rpc('litvm_raffle_create_game_session', {
      user_wallet: walletAddress,
      payment_tx_hash: txHash
    });

    if (error) {
      console.error('Error creating game session:', error);
      return NextResponse.json(
        { error: 'Failed to create game session' },
        { status: 500 }
      );
    }

    const result = data as {
      success: boolean;
      session_id?: string;
      expires_at?: string;
      error?: string;
    };

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create session' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: result.session_id,
      expiresAt: result.expires_at
    });
  } catch (error) {
    console.error('Error in game-session POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Check for active session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('litvm_raffle_get_active_session', {
      p_user_wallet: walletAddress
    });

    if (error) {
      console.error('Error checking active session:', error);
      return NextResponse.json(
        { error: 'Failed to check session' },
        { status: 500 }
      );
    }

    const result = data as {
      success: boolean;
      has_active_session: boolean;
      session_id?: string;
      expires_at?: string;
      created_at?: string;
      reason?: string;
    };

    return NextResponse.json({
      success: true,
      hasActiveSession: result.has_active_session,
      sessionId: result.session_id,
      expiresAt: result.expires_at,
      createdAt: result.created_at
    });
  } catch (error) {
    console.error('Error in game-session GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
