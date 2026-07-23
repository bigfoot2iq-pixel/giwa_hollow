"use client"

import { useState, useEffect, useCallback } from "react"
import type { LeaderboardResponse, LeaderboardEntry } from "@/lib/supabase/types"

interface UseLeaderboardOptions {
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  currentUserWallet?: string | null;
}

export function useLeaderboard(options: UseLeaderboardOptions = {}) {
  const {
    limit = 10,
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
    currentUserWallet
  } = options

  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async (page: number = 1, isRefresh: boolean = false) => {
    if (isRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      const response = await fetch(`/api/leaderboard?page=${page}&limit=${limit}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.statusText}`)
      }

      const result: LeaderboardResponse = await response.json()
      
      if (page === 1) {
        // Replace data for first page or refresh
        setData(result.data)
      } else {
        // Append data for pagination
        setData(prev => [...prev, ...result.data])
      }
      
      setTotal(result.total)
      setCurrentPage(result.page)
      setHasMore(result.hasMore)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error fetching leaderboard:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [limit])

  // Load next page
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return
    
    await fetchLeaderboard(currentPage + 1)
  }, [fetchLeaderboard, currentPage, hasMore, isLoading])

  // Refresh current data
  const refresh = useCallback(async () => {
    await fetchLeaderboard(1, true)
  }, [fetchLeaderboard])

  // Find current user's position in leaderboard
  const getCurrentUserEntry = useCallback((): LeaderboardEntry | null => {
    if (!currentUserWallet) return null
    
    return data.find(entry => 
      entry.wallet_address.toLowerCase() === currentUserWallet.toLowerCase()
    ) || null
  }, [data, currentUserWallet])

  // Get current user's rank (even if not in visible data)
  const getCurrentUserRank = useCallback((): number | null => {
    const userEntry = getCurrentUserEntry()
    return userEntry ? userEntry.rank : null
  }, [getCurrentUserEntry])

  // Check if current user is in top performers
  const isCurrentUserInTop = useCallback((topN: number = 10): boolean => {
    const userRank = getCurrentUserRank()
    return userRank !== null && userRank <= topN
  }, [getCurrentUserRank])

  // Initial load
  useEffect(() => {
    fetchLeaderboard(1)
  }, [fetchLeaderboard])

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return

    const interval = setInterval(() => {
      fetchLeaderboard(1, true)
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchLeaderboard])

  // Reset when options change
  useEffect(() => {
    setData([])
    setCurrentPage(1)
    setHasMore(false)
    fetchLeaderboard(1)
  }, [limit]) // Only reset when limit changes

  return {
    // Data
    data,
    total,
    currentPage,
    hasMore,
    lastUpdated,
    
    // Loading states
    isLoading,
    isRefreshing,
    error,
    
    // Actions
    loadMore,
    refresh,
    
    // User-specific data
    getCurrentUserEntry,
    getCurrentUserRank,
    isCurrentUserInTop,
    
    // Computed properties
    isEmpty: data.length === 0 && !isLoading,
    hasData: data.length > 0
  }
} 