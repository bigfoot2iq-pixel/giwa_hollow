"use client"

import { useCallback, useEffect, useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useConfig } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { waitForTransactionReceipt } from '@wagmi/core'
import { formatEther, maxUint256 } from 'viem'
import { THE_ARIWA_GAME_ADDRESS, THE_ARIWA_GAME_ABI } from '@/lib/contracts/theAriwaGame'
import { contracts, AriwaTokenABI } from '@/lib/contracts'

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

const TOKEN_SYMBOL = 'ARIWA'

export function usePayToPlay(): UsePayToPlayReturn {
  const { address } = useAccount()
  const config = useConfig()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<PayStep>('idle')

  // Play price (token wei) from the game contract
  const {
    data: playPrice,
    isLoading: isLoadingPrice,
    refetch: refetchPrice,
  } = useReadContract({
    address: THE_ARIWA_GAME_ADDRESS,
    abi: THE_ARIWA_GAME_ABI,
    functionName: 'getPlayPrice',
  })

  // Player's GIWA balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: contracts.ariwaToken.address,
    abi: AriwaTokenABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // Player's standing allowance to the game contract
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: contracts.ariwaToken.address,
    abi: AriwaTokenABI,
    functionName: 'allowance',
    args: address ? [address, THE_ARIWA_GAME_ADDRESS] : undefined,
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

  // payToPlay spends ARIWA. Once the tx confirms, refresh this hook's own
  // balance/allowance reads, then invalidate every other balanceOf observer
  // (e.g. the header total, which builds its own queryKey) so the whole UI
  // updates without a page reload.
  useEffect(() => {
    if (!isSuccess) return

    refetchBalance()
    refetchAllowance()

    // Header uses a separate useReadContract instance; its queryKey doesn't
    // necessarily match ours, so refetching locally won't touch it. Invalidate
    // any wagmi balanceOf read to force those observers to refetch too.
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey as unknown[]
        const params = key?.[1] as { functionName?: string } | undefined
        return key?.[0] === 'readContract' && params?.functionName === 'balanceOf'
      },
    })
  }, [isSuccess, refetchBalance, refetchAllowance, queryClient])

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
          address: contracts.ariwaToken.address,
          abi: AriwaTokenABI,
          functionName: 'approve',
          args: [THE_ARIWA_GAME_ADDRESS, maxUint256],
        })
        await waitForTransactionReceipt(config, { hash: approveHash })
        await refetchAllowance()
      }

      // 2. Pay to play.
      setStep('paying')
      const hash = await writeContractAsync({
        address: THE_ARIWA_GAME_ADDRESS,
        abi: THE_ARIWA_GAME_ABI,
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
