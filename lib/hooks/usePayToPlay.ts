"use client"

import { useCallback, useEffect, useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useConfig } from 'wagmi'
import { waitForTransactionReceipt } from '@wagmi/core'
import { formatEther, maxUint256 } from 'viem'
import { THE_HOLLOW_GAME_ADDRESS, THE_HOLLOW_GAME_ABI } from '@/lib/contracts/theHollowGame'
import { contracts, HollowTokenABI } from '@/lib/contracts'

type PayStep = 'idle' | 'approving' | 'paying'

interface UsePayToPlayReturn {
  // Read state
  playPrice: bigint | undefined
  playPriceFormatted: string
  balance: bigint | undefined
  hasEnoughBalance: boolean
  needsApproval: boolean

  isLoadingPrice: boolean

  // Write state
  pay: () => Promise<`0x${string}` | null>
  step: PayStep
  isPaying: boolean
  isConfirming: boolean
  txHash: `0x${string}` | undefined
  isSuccess: boolean
  error: string | null

  // Utils
  refetch: () => void
  reset: () => void
}

const TOKEN_SYMBOL = 'HOLLOW'

export function usePayToPlay(): UsePayToPlayReturn {
  const { address } = useAccount()
  const config = useConfig()
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<PayStep>('idle')

  // Play price (token wei) from the game contract
  const {
    data: playPrice,
    isLoading: isLoadingPrice,
    refetch: refetchPrice,
  } = useReadContract({
    address: THE_HOLLOW_GAME_ADDRESS,
    abi: THE_HOLLOW_GAME_ABI,
    functionName: 'getPlayPrice',
  })

  // Player's GIWA balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: contracts.hollowToken.address,
    abi: HollowTokenABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // Player's standing allowance to the game contract
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: contracts.hollowToken.address,
    abi: HollowTokenABI,
    functionName: 'allowance',
    args: address ? [address, THE_HOLLOW_GAME_ADDRESS] : undefined,
    query: { enabled: !!address },
  })

  // Write + wait for the payToPlay tx (the hash session creation is keyed off)
  const {
    data: txHash,
    writeContractAsync,
    isPending,
    reset: resetWrite,
  } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // payToPlay burns HOLLOW. Once the tx confirms, refresh the shared balance
  // (and allowance) query so the header total updates without a page reload.
  // Header reads the same balanceOf queryKey, so refetching here refreshes it too.
  useEffect(() => {
    if (isSuccess) {
      refetchBalance()
      refetchAllowance()
    }
  }, [isSuccess, refetchBalance, refetchAllowance])

  const playPriceFormatted = playPrice
    ? `${formatEther(playPrice)} ${TOKEN_SYMBOL}`
    : '...'

  const hasEnoughBalance =
    playPrice !== undefined && balance !== undefined ? balance >= playPrice : true

  const needsApproval =
    playPrice !== undefined && allowance !== undefined ? allowance < playPrice : false

  // Approve (once, infinite) if needed, then payToPlay.
  const pay = useCallback(async (): Promise<`0x${string}` | null> => {
    if (!address) {
      setError('Wallet not connected')
      return null
    }
    if (!playPrice) {
      setError('Unable to fetch play price')
      return null
    }
    if (balance !== undefined && balance < playPrice) {
      setError(`Not enough ${TOKEN_SYMBOL}. Claim tokens first.`)
      return null
    }

    setError(null)

    try {
      // 1. Ensure the game contract can pull GIWA. Approve max once so future
      //    plays are a single tx.
      const currentAllowance = (allowance as bigint | undefined) ?? 0n
      if (currentAllowance < playPrice) {
        setStep('approving')
        const approveHash = await writeContractAsync({
          address: contracts.hollowToken.address,
          abi: HollowTokenABI,
          functionName: 'approve',
          args: [THE_HOLLOW_GAME_ADDRESS, maxUint256],
        })
        await waitForTransactionReceipt(config, { hash: approveHash })
        await refetchAllowance()
      }

      // 2. Pay to play.
      setStep('paying')
      const hash = await writeContractAsync({
        address: THE_HOLLOW_GAME_ADDRESS,
        abi: THE_HOLLOW_GAME_ABI,
        functionName: 'payToPlay',
      })

      return hash
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction failed'

      if (message.includes('User rejected') || message.includes('User denied')) {
        setError('Transaction cancelled')
      } else if (message.includes('insufficient funds')) {
        setError('Insufficient funds for gas')
      } else if (message.toLowerCase().includes('transfer amount exceeds balance')) {
        setError(`Not enough ${TOKEN_SYMBOL}. Claim tokens first.`)
      } else {
        setError(message)
      }

      return null
    } finally {
      setStep('idle')
    }
  }, [address, playPrice, balance, allowance, writeContractAsync, config, refetchAllowance])

  const refetch = useCallback(() => {
    refetchPrice()
    refetchBalance()
    refetchAllowance()
  }, [refetchPrice, refetchBalance, refetchAllowance])

  const reset = useCallback(() => {
    setError(null)
    setStep('idle')
    resetWrite()
  }, [resetWrite])

  return {
    playPrice,
    playPriceFormatted,
    balance,
    hasEnoughBalance,
    needsApproval,
    isLoadingPrice,
    pay,
    step,
    isPaying: isPending,
    isConfirming,
    txHash,
    isSuccess,
    error,
    refetch,
    reset,
  }
}
