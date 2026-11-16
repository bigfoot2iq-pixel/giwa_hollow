'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import LastStandGame from './LastStandGame';
import { useState, useEffect, useCallback } from 'react';
import { useGameSession } from '@/lib/hooks/useGameSession';
import { usePayToPlay } from '@/lib/hooks/usePayToPlay';
import { formatCompactNumber } from '@/lib/utils/format';

export default function LastStandContainer() {
  const { isConnected, address } = useAccount();
  const [gameStarted, setGameStarted] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [hasPlayedBefore, setHasPlayedBefore] = useState(false);

  // Contract interaction
  const {
    playPriceFormatted,
    hasEnoughBalance,
    needsApproval,
    isLoadingPrice,
    pay,
    step,
    isPaying,
    isConfirming,
    txHash,
    isSuccess: paymentSuccess,
    error: paymentError,
    reset: resetPayment
  } = usePayToPlay();

  const {
    session,
    hasActiveSession,
    isLoading: isSessionLoading,
    isCreating: isCreatingSession,
    error: sessionError,
    createSession,
    checkActiveSession
  } = useGameSession({ walletAddress: address });

  // Exit game when wallet disconnects during gameplay
  useEffect(() => {
    if (!isConnected && gameStarted) {
      setGameStarted(false);
    }
  }, [isConnected, gameStarted]);

  // Handle payment and session creation
  const handlePayToPlay = useCallback(async () => {
    if (!address) return;

    resetPayment();

    try {
      const hash = await pay();
      if (!hash) return;
    } catch (err) {
      console.error('Payment error:', err);
    }
  }, [address, pay, resetPayment]);

  // Create session after payment is confirmed
  useEffect(() => {
    const createSessionAfterPayment = async () => {
      if (paymentSuccess && txHash && address) {
        const newSession = await createSession(txHash);

        if (newSession) {
          setGameStarted(true);
          setHasPlayedBefore(true);
          resetPayment();
        }
      }
    };

    createSessionAfterPayment();
  }, [paymentSuccess, txHash, address, createSession, resetPayment]);

  // Start game if user has active session
  const handleStartWithSession = useCallback(() => {
    if (hasActiveSession) {
      setGameStarted(true);
    }
  }, [hasActiveSession]);

  // Format expiry time
  const formatExpiryTime = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-4 lg:space-y-6">

      {/* Game Area */}
      <div className="ui-container rounded-[28px] p-4 sm:p-6 lg:p-8">
        {gameStarted && hasActiveSession ? (
          // Game Running
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-blue mb-1">Current Score</p>
                <p className="text-2xl sm:text-3xl font-display font-bold text-text-primary">{formatCompactNumber(currentScore)}</p>
              </div>
              {session && (
                <div className="text-left sm:text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-blue mb-1">Session Expires</p>
                  <p className="text-sm text-iris">{formatExpiryTime(session.expiresAt)}</p>
                </div>
              )}
            </div>
            <LastStandGame
              onScoreUpdate={setCurrentScore}
              walletAddress={address}
              sessionId={session?.sessionId}
              onSessionEnd={() => {
                setGameStarted(false);
                checkActiveSession();
              }}
            />
          </div>
        ) : !isConnected ? (
          // Wallet Connection Required
          <div className="text-center py-12 sm:py-16">
            <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full border border-iris/15 bg-iris/[0.06] text-iris">
              <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
            </span>
            <h3 className="font-header text-2xl font-extrabold tracking-[-0.03em] text-ink mb-3">Connect your wallet</h3>
            <p className="text-ink-soft text-sm sm:text-base mb-6 sm:mb-8 max-w-md mx-auto px-4">
              Face the horde in ARIWA: Last Stand. Connect your wallet to begin your legendary defense.
            </p>
            <div className="flex justify-center">
              <ConnectButton.Custom>
                {({ openConnectModal, openChainModal, chain, mounted }) => {
                  if (!mounted) return null;
                  if (chain?.unsupported) {
                    return (
                      <button
                        onClick={openChainModal}
                        className="inline-flex h-12 items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-6 text-[11px] font-bold uppercase tracking-[0.14em] text-red-600 dark:text-red-400 transition hover:bg-red-500/15"
                      >
                        <span className="material-symbols-outlined text-sm">warning</span>
                        Wrong network
                      </button>
                    );
                  }
                  return (
                    <button onClick={openConnectModal} className="btn-iris h-12 px-6 text-[11px]">
                      <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                      Connect wallet
                    </button>
                  );
                }}
              </ConnectButton.Custom>
            </div>
          </div>
        ) : (
          // Pay to Play / Session Selection
          <div className="text-center py-12 sm:py-16">
            <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full border border-iris/15 bg-iris/[0.06] text-iris">
              <span className="material-symbols-outlined text-3xl">swords</span>
            </span>
            <h3 className="font-header text-2xl font-extrabold tracking-[-0.03em] text-ink mb-2">ARIWA</h3>
            <p className="text-ink-mute mb-6 sm:mb-8 text-sm sm:text-base">Last Stand mode</p>

            <div className="max-w-md mx-auto space-y-4 sm:space-y-6 px-4">
              {/* Session Status */}
              {isSessionLoading ? (
                <div className="flex items-center justify-center gap-2 text-muted-blue py-4">
                  <div className="w-4 h-4 border-2 border-ink/20 border-t-iris rounded-full animate-spin"></div>
                  <span>Checking session...</span>
                </div>
              ) : hasActiveSession && session ? (
                // Has Active Session
                <div className="space-y-4">
                  <div className="ui-container p-4 rounded bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400 mb-2">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      <span className="text-sm font-bold uppercase tracking-widest">Active Session</span>
                    </div>
                    <p className="text-xs text-muted-blue">
                      Expires in: {formatExpiryTime(session.expiresAt)}
                    </p>
                  </div>

                  <button
                    onClick={handleStartWithSession}
                    className="btn-iris h-12 w-full text-[11px]"
                  >
                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                    Continue playing
                  </button>
                </div>
              ) : (
                // No Active Session - Pay to Play
                <div className="space-y-4">
                  {(paymentError || sessionError) && (
                    <div className="ui-container p-4 rounded bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm">
                      {paymentError || sessionError}
                    </div>
                  )}

                  {/* Play cost in ARIWA */}
                  <div className="rounded-2xl border border-ink/[0.08] bg-paper/60 p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute mb-1">Play cost</p>
                    <p className="font-header text-xl font-extrabold text-ink">
                      {isLoadingPrice ? '...' : playPriceFormatted}
                    </p>
                    {!hasEnoughBalance && (
                      <p className="text-[11px] text-red-500 mt-1">Not enough ARIWA — buy more below.</p>
                    )}
                  </div>

                  <button
                    onClick={handlePayToPlay}
                    disabled={isPaying || isConfirming || isCreatingSession || isLoadingPrice || step !== 'idle' || !hasEnoughBalance}
                    className="btn-iris h-12 w-full text-[11px]"
                  >
                    {step === 'approving' ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-dark-navy border-t-transparent rounded-full animate-spin mr-2"></span>
                        Approving ARIWA...
                      </>
                    ) : isPaying ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-dark-navy border-t-transparent rounded-full animate-spin mr-2"></span>
                        Confirm in Wallet...
                      </>
                    ) : isConfirming ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-dark-navy border-t-transparent rounded-full animate-spin mr-2"></span>
                        Confirming Transaction...
                      </>
                    ) : isCreatingSession ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-dark-navy border-t-transparent rounded-full animate-spin mr-2"></span>
                        Creating Session...
                      </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm mr-2 inline-block">payments</span>
                          {needsApproval ? 'Approve & Pay' : hasPlayedBefore ? 'Replay' : 'Pay To Play'}
                        </>
                      )}
                  </button>

                  <p className="text-xs text-muted-blue">
                    One payment = one game round until you lose
                  </p>

                  {/* Get ARIWA to pay, plus native gas for the tx */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
                    <Link
                      href="/trade"
                      className="flex items-center justify-center gap-2 text-xs font-bold text-iris transition-opacity hover:opacity-80"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>swap_horiz</span>
                      Need ARIWA? Buy on the desk
                    </Link>
                    <Link
                      href="/faucet"
                      className="flex items-center justify-center gap-2 text-xs font-bold text-iris transition-opacity hover:opacity-80"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>water_drop</span>
                      Need gas? Get testnet ETH
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Game Features */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <div className="ui-container rounded-[22px] p-5 text-center">
          <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-blush/45 text-blush-ink">
            <span className="material-symbols-outlined text-2xl">swords</span>
          </span>
          <h4 className="text-ink font-bold mb-1 sm:mb-2 text-xs sm:text-sm lg:text-base">Charged Attacks</h4>
          <p className="text-[10px] sm:text-xs lg:text-sm text-ink-mute">Hold to unleash powerful slashes</p>
        </div>
        <div className="ui-container rounded-[22px] p-5 text-center">
          <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-mint/45 text-mint-ink">
            <span className="material-symbols-outlined text-2xl">favorite</span>
          </span>
          <h4 className="text-ink font-bold mb-1 sm:mb-2 text-xs sm:text-sm lg:text-base">3 Lives System</h4>
          <p className="text-[10px] sm:text-xs lg:text-sm text-ink-mute">Every hit counts - survive!</p>
        </div>
        <div className="ui-container rounded-[22px] p-5 text-center">
          <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-butter/55 text-butter-ink">
            <span className="material-symbols-outlined text-2xl">target</span>
          </span>
          <h4 className="text-ink font-bold mb-1 sm:mb-2 text-xs sm:text-sm lg:text-base">Perfect Dodge</h4>
          <p className="text-[10px] sm:text-xs lg:text-sm text-ink-mute">Time it right for slow-mo</p>
        </div>
        <div className="ui-container rounded-[22px] p-5 text-center">
          <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-sky/55 text-sky-ink">
            <span className="material-symbols-outlined text-2xl">emoji_events</span>
          </span>
          <h4 className="text-ink font-bold mb-1 sm:mb-2 text-xs sm:text-sm lg:text-base">Wave Survival</h4>
          <p className="text-[10px] sm:text-xs lg:text-sm text-ink-mute">How long can you last?</p>
        </div>
      </div>
    </div>
  );
}
