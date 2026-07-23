"use client"

import { useState, useEffect, useCallback } from "react"

export interface Holder {
  rank: number
  address: string
  nameTag: string
  quantity: string
  quantityRaw: string
  percentage: string
}

interface TokenHoldersResponse {
  holders: Holder[]
  totalHolders: number
  totalPages: number
  currentPage: number
  hasMore: boolean
}

interface UseTokenHoldersOptions {
  tokenAddress?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

export function useTokenHolders(options: UseTokenHoldersOptions = {}) {
  const {
    tokenAddress,
    autoRefresh = true,
    refreshInterval = 30000
  } = options

  const [holders, setHolders] = useState<Holder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalHolders, setTotalHolders] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchHolders = useCallback(async (page: number = 1, isRefresh: boolean = false) => {
    if (!tokenAddress) return

    if (isRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      const response = await fetch(`/api/holders?address=${tokenAddress}&page=${page}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to fetch holders: ${response.statusText}`)
      }

      const result: TokenHoldersResponse = await response.json()

      if (page === 1) {
        setHolders(result.holders)
      } else {
        setHolders(prev => [...prev, ...result.holders])
      }

      setTotalHolders(result.totalHolders)
      setTotalPages(result.totalPages)
      setCurrentPage(result.currentPage)
      setHasMore(result.hasMore)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error fetching token holders:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch token holders')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [tokenAddress])

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return

    await fetchHolders(currentPage + 1)
  }, [fetchHolders, currentPage, hasMore, isLoading])

  const refresh = useCallback(async () => {
    await fetchHolders(1, true)
  }, [fetchHolders])

  useEffect(() => {
    if (tokenAddress) {
      fetchHolders(1)
    }
  }, [tokenAddress, fetchHolders])

  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0 || !tokenAddress) return

    const interval = setInterval(() => {
      fetchHolders(1, true)
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, tokenAddress, fetchHolders])

  useEffect(() => {
    setHolders([])
    setCurrentPage(1)
    setHasMore(false)
    if (tokenAddress) {
      fetchHolders(1)
    }
  }, [tokenAddress])

  return {
    holders,
    totalHolders,
    totalPages,
    currentPage,
    hasMore,
    lastUpdated,
    isLoading,
    isRefreshing,
    error,
    loadMore,
    refresh,
    isEmpty: holders.length === 0 && !isLoading,
    hasData: holders.length > 0
  }
}
