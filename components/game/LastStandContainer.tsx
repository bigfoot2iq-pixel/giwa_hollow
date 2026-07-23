'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import LastStandGame from './LastStandGame';
import { useState, useEffect, useCallback } from 'react';
import { useMultiUser } from '@/lib/hooks/useMultiUser';
import { useGameSession } from '@/lib/hooks/useGameSession';
import { usePayToPlay } from '@/lib/hooks/usePayToPlay';

export default function LastStandContainer() {
  const { isConnected } = useAccount();
  const { user } = useMultiUser();
  const [gameStarted, setGameStarted] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [hasPlayedBefore, setHasPlayedBefore] = useState(false);

  // Contract interaction
  const {
    playPriceFormatted,
    playPriceUsd,
    isLoadingPrice,
    pay,
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
  } = useGameSession({ walletAddress: user?.wallet_address });

  // Exit game when wallet disconnects during gameplay
  useEffect(() => {
    if (!isConnected && gameStarted) {
      setGameStarted(false);
    }
  }, [isConnected, gameStarted]);

  // Handle payment and session creation
  const handlePayToPlay = useCallback(async () => {
    if (!user?.wallet_address) return;

    resetPayment();

    try {
      const hash = await pay();
      if (!hash) return;
    } catch (err) {
      console.error('Payment error:', err);
    }
  }, [user?.wallet_address, pay, resetPayment]);

  // Create session after payment is confirmed
  useEffect(() => {
    const createSessionAfterPayment = async () => {
      if (paymentSuccess && txHash && user?.wallet_address) {
        const newSession = await createSession(txHash);

        if (newSession) {
          setGameStarted(true);
          setHasPlayedBefore(true);
          resetPayment();
        }
      }
    };

    createSessionAfterPayment();
  }, [paymentSuccess, txHash, user?.wallet_address, createSession, resetPayment]);

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
      <div className="ui-container rounded p-4 sm:p-6 lg:p-8">
        {gameStarted && hasActiveSession ? (
          // Game Running
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-blue mb-1">Current Score</p>
                <p className="text-2xl sm:text-3xl font-display font-bold text-text-primary">{currentScore}</p>
              </div>
              {session && (
                <div className="text-left sm:text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-blue mb-1">Session Expires</p>
                  <p className="text-sm text-[#2ee6a6]">{formatExpiryTime(session.expiresAt)}</p>
                </div>
              )}
            </div>
            <LastStandGame
              onScoreUpdate={setCurrentScore}
              walletAddress={user?.wallet_address}
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
            <span className="material-symbols-outlined text-muted-blue text-5xl sm:text-6xl mb-4 sm:mb-6 block">account_balance_wallet</span>
            <h3 className="text-xl sm:text-2xl font-header text-text-primary mb-3 sm:mb-4">Connect Your Wallet</h3>
            <p className="text-muted-blue text-sm sm:text-base mb-6 sm:mb-8 max-w-md mx-auto px-4">
              Face the horde in The Hollow: Last Stand. Connect your wallet to begin your legendary defense.
            </p>
            <div className="flex justify-center">
              <ConnectButton.Custom>
                {({ openConnectModal, openChainModal, chain, mounted }) => {
                  if (!mounted) return null;
                  if (chain?.unsupported) {
                    return (
                      <button
                        onClick={openChainModal}
                        className="px-6 sm:px-8 py-3 sm:py-4 bg-red-500 hover:bg-red-600 text-text-primary font-bold rounded uppercase tracking-widest text-xs sm:text-sm transition-all inline-flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">warning</span>
                        Wrong Network
                      </button>
                    );
                  }
                  return (
                    <button
                      onClick={openConnectModal}
                      className="px-6 sm:px-8 py-3 sm:py-4 bg-[#0c1512] border border-white/10 hover:brightness-125 text-text-primary font-bold rounded uppercase tracking-widest text-xs sm:text-sm transition-all inline-flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                      Connect Wallet
                    </button>
                  );
                }}
              </ConnectButton.Custom>
            </div>
          </div>
        ) : (
          // Pay to Play / Session Selection
          <div className="text-center py-12 sm:py-16">
            <span className="material-symbols-outlined text-[#2ee6a6] text-5xl sm:text-6xl mb-4 sm:mb-6 block">swords</span>
            <h3 className="text-xl sm:text-2xl font-header text-text-primary mb-2">The Hollow</h3>
            <p className="text-muted-blue mb-6 sm:mb-8 text-sm sm:text-base">Last Stand Mode</p>

            <div className="max-w-md mx-auto space-y-4 sm:space-y-6 px-4">
              {/* Session Status */}
              {isSessionLoading ? (
                <div className="flex items-center justify-center gap-2 text-muted-blue py-4">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-[#2ee6a6] rounded-full animate-spin"></div>
                  <span>Checking session...</span>
                </div>
              ) : hasActiveSession && session ? (
                // Has Active Session
                <div className="space-y-4">
                  <div className="ui-container p-4 rounded bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      <span className="text-sm font-bold uppercase tracking-widest">Active Session</span>
                    </div>
                    <p className="text-xs text-muted-blue">
                      Expires in: {formatExpiryTime(session.expiresAt)}
                    </p>
                  </div>

                  <button
                    onClick={handleStartWithSession}
                    className="w-full px-6 sm:px-8 py-3 sm:py-4 bg-[#0c1512] border border-white/10 hover:brightness-125 text-text-primary font-bold rounded uppercase tracking-widest text-xs sm:text-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-sm mr-2 inline-block">play_arrow</span>
                    Continue Playing
                  </button>
                </div>
              ) : (
                // No Active Session - Pay to Play
                <div className="space-y-4">
                  {(paymentError || sessionError) && (
                    <div className="ui-container p-4 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                      {paymentError || sessionError}
                    </div>
                  )}

                  <button
                    onClick={handlePayToPlay}
                    disabled={isPaying || isConfirming || isCreatingSession || isLoadingPrice}
                    className="w-full px-6 sm:px-8 py-3 sm:py-4 bg-[#0c1512] border border-white/10 hover:brightness-125 text-text-primary font-bold rounded uppercase tracking-widest text-xs sm:text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPaying ? (
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
                          {hasPlayedBefore ? 'Replay' : 'Pay To Play'}
                        </>
                      )}
                  </button>

                  <p className="text-xs text-muted-blue">
                    One payment = one game round until you lose
                  </p>

                  {/* Faucet link — paying costs gas */}
                  <Link
                    href="/faucet"
                    className="flex items-center justify-center gap-2 text-xs font-bold text-[#2ee6a6] transition-opacity hover:opacity-80"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>water_drop</span>
                    Need gas? Get testnet tokens
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Game Features */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <div className="ui-container p-4 sm:p-5 lg:p-6 rounded text-center">
          <span className="material-symbols-outlined text-[#2ee6a6] text-3xl sm:text-4xl mb-2 sm:mb-3 block">swords</span>
          <h4 className="text-text-primary font-bold mb-1 sm:mb-2 text-xs sm:text-sm lg:text-base">Charged Attacks</h4>
          <p className="text-[10px] sm:text-xs lg:text-sm text-muted-blue">Hold to unleash powerful slashes</p>
        </div>
        <div className="ui-container p-4 sm:p-5 lg:p-6 rounded text-center">
          <span className="material-symbols-outlined text-[#2ee6a6] text-3xl sm:text-4xl mb-2 sm:mb-3 block">favorite</span>
          <h4 className="text-text-primary font-bold mb-1 sm:mb-2 text-xs sm:text-sm lg:text-base">3 Lives System</h4>
          <p className="text-[10px] sm:text-xs lg:text-sm text-muted-blue">Every hit counts - survive!</p>
        </div>
        <div className="ui-container p-4 sm:p-5 lg:p-6 rounded text-center">
          <span className="material-symbols-outlined text-[#2ee6a6] text-3xl sm:text-4xl mb-2 sm:mb-3 block">target</span>
          <h4 className="text-text-primary font-bold mb-1 sm:mb-2 text-xs sm:text-sm lg:text-base">Perfect Dodge</h4>
          <p className="text-[10px] sm:text-xs lg:text-sm text-muted-blue">Time it right for slow-mo</p>
        </div>
        <div className="ui-container p-4 sm:p-5 lg:p-6 rounded text-center">
          <span className="material-symbols-outlined text-[#2ee6a6] text-3xl sm:text-4xl mb-2 sm:mb-3 block">emoji_events</span>
          <h4 className="text-text-primary font-bold mb-1 sm:mb-2 text-xs sm:text-sm lg:text-base">Wave Survival</h4>
          <p className="text-[10px] sm:text-xs lg:text-sm text-muted-blue">How long can you last?</p>
        </div>
      </div>
    </div>
  );
}
