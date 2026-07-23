"use client"

import { useState, useEffect, useCallback } from "react"
import type { GameMode } from "@/types/game-types"
import type { ScoreUpdateResponse } from "@/lib/supabase/types"

const HIGH_SCORE_PREFIX = "the-hollow-high-score"

interface UseHighScoreOptions {
  walletAddress?: string | null;
}

export function useHighScore(gameMode: GameMode, options: UseHighScoreOptions = {}) {
  const [highScore, setHighScore] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSubmissionResult, setLastSubmissionResult] = useState<ScoreUpdateResponse | null>(null)
  
  const { walletAddress } = options
  const highScoreKey = `${HIGH_SCORE_PREFIX}-${gameMode}`

  // Fetch high score from database if wallet is connected
  const fetchDatabaseScore = useCallback(async () => {
    if (!walletAddress) return 0

    try {
      const response = await fetch(`/api/game-score?walletAddress=${encodeURIComponent(walletAddress)}`)
      if (!response.ok) {
        throw new Error('Failed to fetch score')
      }
      
      const data = await response.json()
      return data.score || 0
    } catch (err) {
      console.error('Error fetching database score:', err)
      return 0
    }
  }, [walletAddress])

  // Load high score on mount and wallet changes
  useEffect(() => {
    const loadHighScore = async () => {
      setIsLoading(true)
      setError(null)

      try {
        if (walletAddress) {
          // Fetch from database if wallet is connected
          const dbScore = await fetchDatabaseScore()
          const localScore = typeof window !== 'undefined' 
            ? parseInt(localStorage.getItem(highScoreKey) || '0', 10)
            : 0
          
          // Use the higher of the two scores
          const finalScore = Math.max(dbScore, localScore)
          setHighScore(finalScore)
          
          // Update localStorage to match database if needed
          if (typeof window !== 'undefined' && dbScore > localScore) {
            localStorage.setItem(highScoreKey, dbScore.toString())
          }
        } else {
          // Use local storage for non-connected users
          if (typeof window !== 'undefined') {
            const savedHighScore = localStorage.getItem(highScoreKey)
            setHighScore(savedHighScore ? parseInt(savedHighScore, 10) : 0)
          }
        }
      } catch (err) {
        console.error('Error loading high score:', err)
        setError('Failed to load high score')
        
        // Fallback to localStorage
        if (typeof window !== 'undefined') {
          const savedHighScore = localStorage.getItem(highScoreKey)
          setHighScore(savedHighScore ? parseInt(savedHighScore, 10) : 0)
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadHighScore()
  }, [highScoreKey, gameMode, walletAddress, fetchDatabaseScore])

  // Update high score with database integration
  const updateHighScore = useCallback(async (currentScore: number): Promise<boolean> => {
    // Always update localStorage first (immediate feedback)
    const isNewLocalHigh = currentScore > highScore
    if (isNewLocalHigh) {
      setHighScore(currentScore)
      if (typeof window !== 'undefined') {
        localStorage.setItem(highScoreKey, currentScore.toString())
      }
    }

    // If wallet is connected, try to update database
    if (walletAddress && currentScore > 0) {
      setIsSubmitting(true)
      setError(null)

      try {
        const response = await fetch('/api/game-score', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress,
            score: currentScore
          })
        })

        if (!response.ok) {
          throw new Error('Failed to update score')
        }

        const result: ScoreUpdateResponse = await response.json()
        setLastSubmissionResult(result)

        // Update high score with the database's current score
        if (result.current_score > highScore) {
          setHighScore(result.current_score)
          if (typeof window !== 'undefined') {
            localStorage.setItem(highScoreKey, result.current_score.toString())
          }
        }

        return result.updated || isNewLocalHigh
      } catch (err) {
        console.error('Error updating database score:', err)
        setError('Failed to sync score with database')
        
        // Still return true if it was a new local high score
        return isNewLocalHigh
      } finally {
        setIsSubmitting(false)
      }
    }

    return isNewLocalHigh
  }, [highScore, highScoreKey, walletAddress])

  // Clear submission result
  const clearSubmissionResult = useCallback(() => {
    setLastSubmissionResult(null)
  }, [])

  return { 
    highScore, 
    updateHighScore,
    isLoading,
    error,
    isSubmitting,
    lastSubmissionResult,
    clearSubmissionResult
  }
} 