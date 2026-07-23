"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useSignMessage } from "wagmi"
import { CANVAS_WIDTH, CANVAS_HEIGHT, ANIMATIONS, type Controls } from "@/game-v2/types"
import { createInitialState, updateGame, resetGame } from "@/game-v2/engine"
import { renderGame } from "@/game-v2/renderer"
import { useHighScore } from "@/lib/hooks/useHighScore"
import { useGameSession } from "@/lib/hooks/useGameSession"
import { buildScoreMessage } from "@/lib/utils/scoreAuth"

interface LastStandGameProps {
  onScoreUpdate?: (score: number) => void
  walletAddress?: string | null
  sessionId?: string | null
  onSessionEnd?: () => void
}

export default function LastStandGame({ onScoreUpdate, walletAddress, sessionId, onSessionEnd }: LastStandGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameStateRef = useRef(createInitialState())
  const imagesRef = useRef<Record<string, HTMLImageElement>>({})
  const controlsRef = useRef<Controls>({
    left: false,
    right: false,
    jump: false,
    attack: false,
    dodge: false,
  })
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [wave, setWave] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  const animationFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const hasSubmittedScoreRef = useRef(false)

  // High score hook - persists to database for connected wallets (fallback for non-session play)
  const { 
    highScore, 
    updateHighScore, 
    isSubmitting 
  } = useHighScore('medium', { walletAddress })

  // Game session hook - for pay-to-play
  const {
    completeSession,
    isCompleting: isCompletingSession
  } = useGameSession({ walletAddress })

  // Wallet signing - proves the score submission was authorized by the player
  const { signMessageAsync } = useSignMessage()

  // Sync high score with game state
  useEffect(() => {
    if (highScore > 0 && gameStateRef.current) {
      gameStateRef.current.highScore = highScore
    }
  }, [highScore])

  // Submit score when game ends - use session endpoint if sessionId exists
  useEffect(() => {
    if (gameOver && score >= 0 && !hasSubmittedScoreRef.current) {
      hasSubmittedScoreRef.current = true
      
      const submitScore = async () => {
        try {
          if (sessionId && walletAddress) {
            // Pay-to-play mode: sign the score to prove ownership, then
            // complete session and update score atomically
            const signature = await signMessageAsync({
              message: buildScoreMessage({ walletAddress, sessionId, score }),
            })
            const result = await completeSession(score, signature)

            if (result) {
              setIsNewHighScore(result.updated)
              setSessionEnded(true)
              
              // Update game state with new high score
              if (result.updated) {
                gameStateRef.current.highScore = result.current_score
              }
            }
          } else {
            // Free play mode (fallback): use regular high score update
            const isNew = await updateHighScore(score)
            setIsNewHighScore(isNew)
            
            if (isNew) {
              gameStateRef.current.highScore = score
            }
          }
        } catch (error) {
          console.error('Error submitting score:', error)
        }
      }
      
      submitScore()
    }
  }, [gameOver, score, sessionId, walletAddress, completeSession, updateHighScore, signMessageAsync])

  // Reset submission flag when game restarts
  useEffect(() => {
    if (!gameOver) {
      hasSubmittedScoreRef.current = false
      setIsNewHighScore(false)
      setSessionEnded(false)
    }
  }, [gameOver])

  // Notify parent when session ends (for pay-to-play)
  useEffect(() => {
    if (sessionEnded && onSessionEnd) {
      // Small delay to show the game over screen before redirecting
      const timer = setTimeout(() => {
        onSessionEnd()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [sessionEnded, onSessionEnd])

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load images
  useEffect(() => {
    const imageList = Object.entries(ANIMATIONS).map(([key, data]) => ({
      name: key,
      src: data.src,
    }))

    let loadedCount = 0
    const totalImages = imageList.length

    imageList.forEach(({ name, src }) => {
      const img = new Image()
      img.onload = () => {
        imagesRef.current[name] = img
        loadedCount++
        if (loadedCount === totalImages) {
          setImagesLoaded(true)
        }
      }
      img.onerror = () => {
        console.error(`Failed to load image: ${src}`)
        loadedCount++
        if (loadedCount === totalImages) {
          setImagesLoaded(true)
        }
      }
      img.src = src
    })
  }, [])

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      
      switch (e.key.toLowerCase()) {
        case 'a':
        case 'arrowleft':
          controlsRef.current.left = true
          break
        case 'd':
        case 'arrowright':
          controlsRef.current.right = true
          break
        case 'w':
        case 'arrowup':
        case ' ':
          e.preventDefault()
          controlsRef.current.jump = true
          // Restart game if game over (disabled in pay-to-play mode after session ends)
          if (gameStateRef.current.gameOver && !(sessionId && sessionEnded)) {
            gameStateRef.current = resetGame(gameStateRef.current)
            setGameOver(false)
          }
          break
        case 'j':
          controlsRef.current.attack = true
          break
        case 'l':
        case 'shift':
          controlsRef.current.dodge = true
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'a':
        case 'arrowleft':
          controlsRef.current.left = false
          break
        case 'd':
        case 'arrowright':
          controlsRef.current.right = false
          break
        case 'w':
        case 'arrowup':
        case ' ':
          controlsRef.current.jump = false
          break
        case 'j':
          controlsRef.current.attack = false
          break
        case 'l':
        case 'shift':
          controlsRef.current.dodge = false
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [sessionId, sessionEnded])

  // Handle click to restart (disabled in pay-to-play mode after session ends)
  const handleCanvasClick = useCallback(() => {
    if (gameStateRef.current.gameOver) {
      // In pay-to-play mode, don't allow restart after session ends
      if (sessionId && sessionEnded) {
        // Session is over, user needs to pay again
        return
      }
      
      gameStateRef.current = resetGame(gameStateRef.current)
      setGameOver(false)
    }
  }, [sessionId, sessionEnded])

  // Game loop
  useEffect(() => {
    if (!imagesLoaded) return

    const gameLoop = (timestamp: number) => {
      const deltaTime = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp

      // Target 60 FPS
      const deltaScale = Math.min(deltaTime / 16.67, 2)

      // Update game state
      gameStateRef.current = updateGame(
        gameStateRef.current,
        controlsRef.current,
        deltaScale
      )

      // Update React state for UI
      if (gameStateRef.current.gameOver !== gameOver) {
        setGameOver(gameStateRef.current.gameOver)
      }
      if (gameStateRef.current.score !== score) {
        setScore(gameStateRef.current.score)
        onScoreUpdate?.(gameStateRef.current.score)
      }
      if (gameStateRef.current.wave !== wave) {
        setWave(gameStateRef.current.wave)
      }

      // Render
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (ctx) {
        renderGame(ctx, gameStateRef.current, imagesRef.current)
      }

      animationFrameRef.current = requestAnimationFrame(gameLoop)
    }

    animationFrameRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [imagesLoaded, gameOver, score, wave, onScoreUpdate])

  if (!imagesLoaded) {
    return (
      <div 
        className="flex items-center justify-center bg-dark-navy"
        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      >
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-primary">Loading game assets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={handleCanvasClick}
        className="bg-dark-navy cursor-pointer w-full h-auto rounded"
        style={{ maxWidth: '100%', height: 'auto', aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
      />
      
      {/* Mobile Touch Controls */}
      {isMobile && (
        <div className="mt-4 flex justify-between gap-2 px-2">
          {/* Left side - Movement */}
          <div className="flex gap-2">
            <button
              className="w-12 h-12 sm:w-14 sm:h-14 bg-dark-navy/80 border-2 border-dark-blue/50 rounded-xl text-text-primary font-bold text-lg sm:text-xl active:bg-primary active:text-dark-navy transition-colors touch-none"
              onTouchStart={() => controlsRef.current.left = true}
              onTouchEnd={() => controlsRef.current.left = false}
            >
              ←
            </button>
            <button
              className="w-12 h-12 sm:w-14 sm:h-14 bg-dark-navy/80 border-2 border-dark-blue/50 rounded-xl text-text-primary font-bold text-lg sm:text-xl active:bg-primary active:text-dark-navy transition-colors touch-none"
              onTouchStart={() => controlsRef.current.right = true}
              onTouchEnd={() => controlsRef.current.right = false}
            >
              →
            </button>
          </div>
          
          {/* Right side - Actions */}
          <div className="flex gap-2">
            <button
              className="w-12 h-12 sm:w-14 sm:h-14 bg-dark-navy/80 border-2 border-dark-blue/50 rounded-xl text-text-primary font-bold text-[10px] sm:text-xs active:bg-primary active:text-dark-navy transition-colors touch-none"
              onTouchStart={() => controlsRef.current.dodge = true}
              onTouchEnd={() => controlsRef.current.dodge = false}
            >
              DODGE
            </button>
            <button
              className="w-12 h-12 sm:w-14 sm:h-14 bg-dark-navy/80 border-2 border-primary/50 rounded-xl text-primary font-bold text-[10px] sm:text-xs active:bg-primary active:text-dark-navy transition-colors touch-none"
              onTouchStart={() => controlsRef.current.jump = true}
              onTouchEnd={() => controlsRef.current.jump = false}
            >
              JUMP
            </button>
            <button
              className="w-14 h-12 sm:w-16 sm:h-14 bg-primary/20 border-2 border-primary rounded-xl text-primary font-bold text-[10px] sm:text-xs active:bg-primary active:text-dark-navy transition-colors touch-none"
              onTouchStart={() => controlsRef.current.attack = true}
              onTouchEnd={() => controlsRef.current.attack = false}
            >
              ATTACK
            </button>
          </div>
        </div>
      )}

      {/* Desktop Control instructions */}
      {!isMobile && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:gap-4 lg:gap-6 px-2 sm:px-4 py-3 bg-dark-navy/50 border border-dark-blue/30 rounded-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs sm:text-sm font-semibold">Move:</span>
            <div className="flex gap-1">
              <kbd className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#2a2200] rounded text-text-primary font-mono text-[10px] sm:text-xs shadow-md">A</kbd>
              <kbd className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#2a2200] rounded text-text-primary font-mono text-[10px] sm:text-xs shadow-md">D</kbd>
            </div>
          </div>

          <div className="w-px h-4 sm:h-6 bg-dark-blue/30" />

          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs sm:text-sm font-semibold">Jump:</span>
            <kbd className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#2a2200] rounded text-text-primary font-mono text-[10px] sm:text-xs shadow-md">W</kbd>
            <kbd className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#2a2200] rounded text-text-primary font-mono text-[10px] sm:text-xs shadow-md">Space</kbd>
          </div>

          <div className="w-px h-4 sm:h-6 bg-dark-blue/30" />

          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs sm:text-sm font-semibold">Attack:</span>
            <kbd className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#2a2200] rounded text-text-primary font-mono text-[10px] sm:text-xs shadow-md">J</kbd>
            <span className="text-gray-500 text-[10px] sm:text-xs hidden sm:inline">(hold for charged)</span>
          </div>

          <div className="w-px h-4 sm:h-6 bg-dark-blue/30 hidden lg:block" />

          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs sm:text-sm font-semibold">Dodge:</span>
            <kbd className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#2a2200] rounded text-text-primary font-mono text-[10px] sm:text-xs shadow-md">L</kbd>
            <kbd className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#2a2200] rounded text-text-primary font-mono text-[10px] sm:text-xs shadow-md">Shift</kbd>
          </div>
        </div>
      )}
    </div>
  )
}
