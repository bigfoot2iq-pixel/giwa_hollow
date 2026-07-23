"use client"

import { useState, useCallback, useEffect } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatEther } from 'viem'
import { THE_HOLLOW_GAME_ADDRESS, THE_HOLLOW_GAME_ABI } from '@/lib/contracts/theHollowGame'

interface UsePayToPlayReturn {
  // Read state
  playPrice: bigint | undefined
  playPriceFormatted: string
  playPriceUsd: string
  ethPrice: number | null
  isLoadingPrice: boolean
  
  // Write state
  pay: () => Promise<`0x${string}` | null>
  isPaying: boolean
  isConfirming: boolean
  txHash: `0x${string}` | undefined
  isSuccess: boolean
  error: string | null
  
  // Utils
  refetch: () => void
  reset: () => void
}

export function usePayToPlay(): UsePayToPlayReturn {
  const [error, setError] = useState<string | null>(null)
  const [ethPrice, setEthPrice] = useState<number | null>(null)
  const [isLoadingEthPrice, setIsLoadingEthPrice] = useState(true)

  // Fetch ETH price from CoinGecko
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
        )
        const data = await response.json()
        setEthPrice(data.ethereum.usd)
      } catch (err) {
        console.error('Failed to fetch ETH price:', err)
        // Fallback price if API fails
        setEthPrice(3500)
      } finally {
        setIsLoadingEthPrice(false)
      }
    }

    fetchEthPrice()
    // Refresh price every 60 seconds
    const interval = setInterval(fetchEthPrice, 60000)
    return () => clearInterval(interval)
  }, [])

  // Read play price from contract
  const { 
    data: playPrice, 
    isLoading: isLoadingContractPrice,
    refetch 
  } = useReadContract({
    address: THE_HOLLOW_GAME_ADDRESS,
    abi: THE_HOLLOW_GAME_ABI,
    functionName: 'getPlayPrice',
  })

  // Write contract
  const { 
    data: txHash,
    writeContractAsync,
    isPending: isPaying,
    reset: resetWrite
  } = useWriteContract()

  // Wait for transaction confirmation
  const { 
    isLoading: isConfirming,
    isSuccess 
  } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Format price for display in ETH
  const playPriceFormatted = playPrice
    ? `${formatEther(playPrice)} ETH`
    : '...'

  // Calculate USD price
  const playPriceUsd = (() => {
    if (!playPrice || !ethPrice) return '...'
    const coinAmount = parseFloat(formatEther(playPrice))
    const usdAmount = coinAmount * ethPrice
    // Format based on amount
    if (usdAmount < 0.01) {
      return `$${usdAmount.toFixed(4)}`
    } else if (usdAmount < 1) {
      return `$${usdAmount.toFixed(3)}`
    } else {
      return `$${usdAmount.toFixed(2)}`
    }
  })()

  const isLoadingPrice = isLoadingContractPrice || isLoadingEthPrice

  // Pay to play function
  const pay = useCallback(async (): Promise<`0x${string}` | null> => {
    if (!playPrice) {
      setError('Unable to fetch play price')
      return null
    }

    setError(null)

    try {
      const hash = await writeContractAsync({
        address: THE_HOLLOW_GAME_ADDRESS,
        abi: THE_HOLLOW_GAME_ABI,
        functionName: 'payToPlay',
        value: playPrice,
      })

      return hash
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction failed'
      
      // Parse common errors
      if (message.includes('User rejected')) {
        setError('Transaction cancelled')
      } else if (message.includes('insufficient funds')) {
        setError('Insufficient funds')
      } else {
        setError(message)
      }
      
      return null
    }
  }, [playPrice, writeContractAsync])

  // Reset state
  const reset = useCallback(() => {
    setError(null)
    resetWrite()
  }, [resetWrite])

  return {
    playPrice,
    playPriceFormatted,
    playPriceUsd,
    ethPrice,
    isLoadingPrice,
    pay,
    isPaying,
    isConfirming,
    txHash,
    isSuccess,
    error,
    refetch,
    reset
  }
}
