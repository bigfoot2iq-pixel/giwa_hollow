"use client"

import { useState, useCallback, useEffect } from "react"
import type { 
  GameSession, 
  CreateSessionResponse, 
  ActiveSessionResponse,
  CompleteSessionResponse 
} from "@/lib/supabase/types"

interface UseGameSessionOptions {
  walletAddress?: string | null;
}

export function useGameSession(options: UseGameSessionOptions = {}) {
  const { walletAddress } = options
  
  const [session, setSession] = useState<GameSession | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check for active session on mount and wallet changes
  const checkActiveSession = useCallback(async () => {
    if (!walletAddress) {
      setSession(null)
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/game-session?walletAddress=${encodeURIComponent(walletAddress)}`
      )
      
      if (!response.ok) {
        throw new Error('Failed to check session')
      }

      const data: ActiveSessionResponse = await response.json()

      if (data.hasActiveSession && data.sessionId) {
        const activeSession: GameSession = {
          sessionId: data.sessionId,
          expiresAt: data.expiresAt || '',
          createdAt: data.createdAt
        }
        setSession(activeSession)
        return activeSession
      } else {
        setSession(null)
        return null
      }
    } catch (err) {
      console.error('Error checking session:', err)
      setError('Failed to check game session')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [walletAddress])

  // Create new session after payment
  const createSession = useCallback(async (txHash: string): Promise<GameSession | null> => {
    if (!walletAddress) {
      setError('Wallet not connected')
      return null
    }

    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/game-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, txHash })
      })

      const data: CreateSessionResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create session')
      }

      if (data.sessionId) {
        const newSession: GameSession = {
          sessionId: data.sessionId,
          expiresAt: data.expiresAt || ''
        }
        setSession(newSession)
        return newSession
      }

      return null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session'
      console.error('Error creating session:', err)
      setError(message)
      return null
    } finally {
      setIsCreating(false)
    }
  }, [walletAddress])

  // Complete session and submit score
  const completeSession = useCallback(async (score: number, signature: string): Promise<CompleteSessionResponse | null> => {
    if (!walletAddress || !session) {
      setError('No active session')
      return null
    }

    setIsCompleting(true)
    setError(null)

    try {
      const response = await fetch('/api/game-session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          walletAddress,
          score,
          signature
        })
      })

      const data: CompleteSessionResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error((data as any).error || 'Failed to complete session')
      }

      // Clear the session after completion
      setSession(null)
      
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete session'
      console.error('Error completing session:', err)
      setError(message)
      return null
    } finally {
      setIsCompleting(false)
    }
  }, [walletAddress, session])

  // Check session on mount
  useEffect(() => {
    checkActiveSession()
  }, [checkActiveSession])

  // Check if session is expired
  const isSessionExpired = useCallback(() => {
    if (!session?.expiresAt) return true
    return new Date(session.expiresAt) < new Date()
  }, [session])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    session,
    hasActiveSession: !!session && !isSessionExpired(),
    isLoading,
    isCreating,
    isCompleting,
    error,
    checkActiveSession,
    createSession,
    completeSession,
    isSessionExpired,
    clearError
  }
}
