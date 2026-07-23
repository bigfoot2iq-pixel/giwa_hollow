// Game Renderer - Drawing the game

import {
  type GameState,
  type Enemy,
  type Projectile,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  ANIMATIONS,
  CHARGED_ATTACK_THRESHOLD,
  LEVEL_THEMES,
} from './types'
import { getCurrentTheme } from './engine'

// Render the entire game
export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  images: Record<string, HTMLImageElement>
) {
  const theme = getCurrentTheme(state.level)
  
  // Apply screen shake
  ctx.save()
  if (state.screenShake > 0) {
    const shakeX = (Math.random() - 0.5) * state.screenShake * 2
    const shakeY = (Math.random() - 0.5) * state.screenShake * 2
    ctx.translate(shakeX, shakeY)
  }
  
  // Clear and draw background
  renderBackground(ctx, state, theme)
  
  // Draw ground
  renderGround(ctx, theme)
  
  // Draw particles (behind entities)
  renderParticles(ctx, state)
  
  // Draw projectiles
  renderProjectiles(ctx, state, theme)
  
  // Draw enemies
  state.enemies.forEach(enemy => renderEnemy(ctx, enemy, images, state, theme))
  
  // Draw slash effects
  renderSlashEffects(ctx, state, theme)
  
  // Draw player
  renderPlayer(ctx, state, images, theme)
  
  ctx.restore()
  
  // Draw UI (not affected by screen shake)
  renderUI(ctx, state, theme)
  
  // Draw overlays
  if (state.gameOver) {
    renderGameOver(ctx, state, theme)
  } else if (state.levelUpTimer > 0) {
    renderLevelUp(ctx, state, theme)
  } else if (!state.isWaveActive && state.wave > 0) {
    renderWaveComplete(ctx, state, theme)
  } else if (state.waveStartTimer > 0 && state.wave === 0) {
    renderGetReady(ctx, theme)
  } else if (state.waveStartTimer > 60 && state.wave > 0) {
    renderWaveStart(ctx, state, theme)
  }
  
  // Slow-mo overlay
  if (state.slowMoTimer > 0) {
    ctx.fillStyle = `${theme.accent}15`
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  }
}

function renderBackground(ctx: CanvasRenderingContext2D, state: GameState, theme: typeof LEVEL_THEMES[0]) {
  // Dynamic gradient background based on level theme
  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
  gradient.addColorStop(0, theme.bgTop)
  gradient.addColorStop(0.5, theme.bgMid)
  gradient.addColorStop(1, theme.bgBottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  
  // Animated particles in background
  const time = Date.now() * 0.001
  ctx.fillStyle = `${theme.accent}40`
  for (let i = 0; i < 25; i++) {
    const x = (i * 137 + time * (10 + i % 5)) % CANVAS_WIDTH
    const y = (i * 73 + Math.sin(time + i) * 20) % (GROUND_Y - 50)
    const size = 1 + (i % 3)
    ctx.fillRect(x, y, size, size)
  }
  
  // Horizon glow with theme color
  const horizonGlow = ctx.createRadialGradient(
    CANVAS_WIDTH / 2, GROUND_Y, 0,
    CANVAS_WIDTH / 2, GROUND_Y, CANVAS_WIDTH * 0.6
  )
  horizonGlow.addColorStop(0, `${theme.accent}15`)
  horizonGlow.addColorStop(1, `${theme.accent}00`)
  ctx.fillStyle = horizonGlow
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  
  // Level transition effect
  if (state.levelUpTimer > 120) {
    const flash = (state.levelUpTimer - 120) / 60
    ctx.fillStyle = `${theme.accent}${Math.floor(flash * 40).toString(16).padStart(2, '0')}`
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  }
}

function renderGround(ctx: CanvasRenderingContext2D, theme: typeof LEVEL_THEMES[0]) {
  // Ground gradient
  const groundGradient = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_HEIGHT)
  groundGradient.addColorStop(0, theme.ground)
  groundGradient.addColorStop(1, theme.bgBottom)
  ctx.fillStyle = groundGradient
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y)
  
  // Ground line with theme glow
  ctx.strokeStyle = `${theme.accent}80`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, GROUND_Y)
  ctx.lineTo(CANVAS_WIDTH, GROUND_Y)
  ctx.stroke()
  
  // Glow above ground
  const glowGradient = ctx.createLinearGradient(0, GROUND_Y - 15, 0, GROUND_Y)
  glowGradient.addColorStop(0, `${theme.accent}00`)
  glowGradient.addColorStop(1, `${theme.accent}25`)
  ctx.fillStyle = glowGradient
  ctx.fillRect(0, GROUND_Y - 15, CANVAS_WIDTH, 15)
}

function renderPlayer(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  images: Record<string, HTMLImageElement>,
  theme: typeof LEVEL_THEMES[0]
) {
  const { player } = state
  
  let animKey = 'playerIdle'
  let maxFrames = ANIMATIONS.playerIdle.frames
  
  if (player.isAttacking) {
    animKey = 'playerAttack'
    maxFrames = ANIMATIONS.playerAttack.frames
  } else if (player.isDodging) {
    animKey = 'playerRun'
    maxFrames = ANIMATIONS.playerRun.frames
  } else if (!player.isGrounded) {
    animKey = 'playerRun'
    maxFrames = ANIMATIONS.playerRun.frames
  } else if (Math.abs(player.velocityX) > 0.1) {
    animKey = 'playerRun'
    maxFrames = ANIMATIONS.playerRun.frames
  }
  
  const image = images[animKey]
  if (!image) return
  
  const anim = ANIMATIONS[animKey as keyof typeof ANIMATIONS]
  const frameWidth = image.width / anim.frames
  const frameHeight = image.height
  const frameX = player.frameX % maxFrames
  
  const visualScale = 1.8
  const visualWidth = player.width * visualScale
  const visualHeight = player.height * visualScale
  const offsetX = (visualWidth - player.width) / 2
  const offsetY = (visualHeight - player.height) / 2
  
  ctx.save()
  
  // Invincibility flash
  if (player.isInvincible && Math.floor(player.invincibilityTimer / 4) % 2 === 0) {
    ctx.globalAlpha = 0.5
  }
  
  // Charging glow
  if (player.isCharging && player.chargeTimer > 10) {
    const chargeProgress = Math.min(1, player.chargeTimer / CHARGED_ATTACK_THRESHOLD)
    ctx.shadowColor = theme.accent
    ctx.shadowBlur = 20 * chargeProgress
  }
  
  // Draw player
  if (player.direction === 'left') {
    ctx.translate(player.x + player.width + offsetX, player.y - offsetY)
    ctx.scale(-1, 1)
  } else {
    ctx.translate(player.x - offsetX, player.y - offsetY)
  }
  
  ctx.drawImage(
    image,
    frameX * frameWidth, 0, frameWidth, frameHeight,
    0, 0, visualWidth, visualHeight
  )
  
  ctx.restore()
  
  // Charge indicator
  if (player.isCharging) {
    const chargeProgress = Math.min(1, player.chargeTimer / CHARGED_ATTACK_THRESHOLD)
    const barWidth = 50
    const barHeight = 6
    const barX = player.x + player.width / 2 - barWidth / 2
    const barY = player.y - 20
    
    ctx.fillStyle = '#333'
    ctx.fillRect(barX, barY, barWidth, barHeight)
    
    ctx.fillStyle = chargeProgress >= 1 ? theme.accent : '#888'
    ctx.fillRect(barX, barY, barWidth * chargeProgress, barHeight)
    
    if (chargeProgress >= 1) {
      ctx.strokeStyle = theme.accent
      ctx.lineWidth = 2
      ctx.strokeRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4)
    }
  }
}

function renderEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  images: Record<string, HTMLImageElement>,
  state: GameState,
  theme: typeof LEVEL_THEMES[0]
) {
  let animKey = ''
  switch (enemy.type) {
    case 'goblin':
      animKey = enemy.isAttacking ? 'goblinAttack' : 'goblinRun'
      break
    case 'skeleton':
      animKey = enemy.isAttacking ? 'skeletonAttack' : 'skeletonWalk'
      break
    case 'ninja':
      animKey = enemy.isAttacking ? 'ninjaAttack' : 'ninjaWalk'
      break
    case 'samurai':
      animKey = enemy.isAttacking ? 'samuraiAttack' : 'samuraiRun'
      break
  }
  
  const image = images[animKey]
  if (!image) return
  
  const anim = ANIMATIONS[animKey as keyof typeof ANIMATIONS]
  const frameWidth = image.width / anim.frames
  const frameHeight = image.height
  const frameX = enemy.frameX % anim.frames
  
  const visualScale = enemy.type === 'samurai' ? 2.6 : 2
  const visualWidth = enemy.width * visualScale
  const visualHeight = enemy.height * visualScale
  const offsetX = (visualWidth - enemy.width) / 2
  const offsetY = (visualHeight - enemy.height) / 2
  
  ctx.save()
  
  // Death fade
  if (enemy.isDying) {
    ctx.globalAlpha = enemy.deathTimer / 30
  }
  
  // Throwing indicator
  if (enemy.isThrowing) {
    ctx.shadowColor = theme.accent
    ctx.shadowBlur = 10
  }
  
  // Enemies face left
  ctx.translate(enemy.x + enemy.width + offsetX, enemy.y - offsetY)
  ctx.scale(-1, 1)
  
  ctx.drawImage(
    image,
    frameX * frameWidth, 0, frameWidth, frameHeight,
    0, 0, visualWidth, visualHeight
  )
  
  ctx.restore()
  
  // Health bar for enemies with more than 1 max health
  if (!enemy.isDying && enemy.maxHealth > 1) {
    const barWidth = 50
    const barHeight = 5
    const barX = enemy.x + enemy.width / 2 - barWidth / 2
    const barY = enemy.y - 12
    const healthPercent = enemy.health / enemy.maxHealth
    
    ctx.fillStyle = '#333'
    ctx.fillRect(barX, barY, barWidth, barHeight)
    ctx.fillStyle = enemy.type === 'samurai' ? '#ff4444' : theme.accent
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight)
    ctx.strokeStyle = `${theme.accent}60`
    ctx.lineWidth = 1
    ctx.strokeRect(barX, barY, barWidth, barHeight)
  }
}

function renderProjectiles(ctx: CanvasRenderingContext2D, state: GameState, theme: typeof LEVEL_THEMES[0]) {
  state.projectiles.forEach(proj => {
    ctx.save()
    ctx.translate(proj.x + proj.width / 2, proj.y + proj.height / 2)
    ctx.rotate(proj.rotation * Math.PI / 180)
    
    if (proj.type === 'shuriken') {
      // Draw shuriken as a star shape
      ctx.fillStyle = '#888888'
      ctx.strokeStyle = theme.accent
      ctx.lineWidth = 2
      
      ctx.beginPath()
      for (let i = 0; i < 4; i++) {
        const angle = (i * 90) * Math.PI / 180
        const outerX = Math.cos(angle) * proj.width / 2
        const outerY = Math.sin(angle) * proj.height / 2
        const innerAngle = ((i * 90) + 45) * Math.PI / 180
        const innerX = Math.cos(innerAngle) * proj.width / 4
        const innerY = Math.sin(innerAngle) * proj.height / 4
        
        if (i === 0) {
          ctx.moveTo(outerX, outerY)
        } else {
          ctx.lineTo(outerX, outerY)
        }
        ctx.lineTo(innerX, innerY)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      
      // Center dot
      ctx.fillStyle = theme.accent
      ctx.beginPath()
      ctx.arc(0, 0, 3, 0, Math.PI * 2)
      ctx.fill()
      
    } else {
      // Draw bone
      ctx.fillStyle = '#dddddd'
      ctx.strokeStyle = '#999999'
      ctx.lineWidth = 1
      
      // Bone shape
      ctx.beginPath()
      ctx.ellipse(-proj.width / 3, 0, 5, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      
      ctx.beginPath()
      ctx.ellipse(proj.width / 3, 0, 5, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      
      ctx.fillRect(-proj.width / 3, -3, proj.width * 2 / 3, 6)
      ctx.strokeRect(-proj.width / 3, -3, proj.width * 2 / 3, 6)
    }
    
    ctx.restore()
  })
}

function renderSlashEffects(ctx: CanvasRenderingContext2D, state: GameState, theme: typeof LEVEL_THEMES[0]) {
  state.slashEffects.forEach(effect => {
    const alpha = effect.timer / (effect.isCharged ? 15 : 10)
    
    ctx.save()
    ctx.globalAlpha = alpha
    
    const gradient = ctx.createLinearGradient(effect.x, effect.y, effect.x + effect.width, effect.y)
    gradient.addColorStop(0, effect.isCharged ? `${theme.accent}ee` : 'rgba(255, 255, 255, 0.8)')
    gradient.addColorStop(0.5, effect.isCharged ? `${theme.accent}99` : 'rgba(200, 200, 200, 0.5)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.ellipse(
      effect.x + effect.width / 2,
      effect.y + effect.height / 2,
      effect.width / 2,
      effect.height / 3,
      0, 0, Math.PI * 2
    )
    ctx.fill()
    
    ctx.strokeStyle = effect.isCharged ? theme.accent : '#ffffff'
    ctx.lineWidth = effect.isCharged ? 4 : 2
    ctx.beginPath()
    ctx.moveTo(effect.x, effect.y + effect.height / 2)
    ctx.lineTo(effect.x + effect.width, effect.y + effect.height / 2 - 10)
    ctx.stroke()
    
    ctx.restore()
  })
}

function renderParticles(ctx: CanvasRenderingContext2D, state: GameState) {
  state.particles.forEach(particle => {
    const alpha = particle.life / particle.maxLife
    ctx.fillStyle = particle.color
    ctx.globalAlpha = alpha
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size)
  })
  ctx.globalAlpha = 1
}

function renderUI(ctx: CanvasRenderingContext2D, state: GameState, theme: typeof LEVEL_THEMES[0]) {
  const { player } = state
  
  // Lives (hearts)
  for (let i = 0; i < Math.max(3, player.lives); i++) {
    const x = 20 + i * 35
    const y = 20
    const filled = i < player.lives
    
    ctx.fillStyle = filled ? '#ff4444' : '#333'
    ctx.beginPath()
    ctx.moveTo(x + 12, y + 5)
    ctx.bezierCurveTo(x + 12, y + 2, x + 8, y, x + 6, y)
    ctx.bezierCurveTo(x, y, x, y + 8, x, y + 8)
    ctx.bezierCurveTo(x, y + 13, x + 6, y + 18, x + 12, y + 22)
    ctx.bezierCurveTo(x + 18, y + 18, x + 24, y + 13, x + 24, y + 8)
    ctx.bezierCurveTo(x + 24, y + 8, x + 24, y, x + 18, y)
    ctx.bezierCurveTo(x + 16, y, x + 12, y + 2, x + 12, y + 5)
    ctx.fill()
  }
  
  // Level indicator
  ctx.fillStyle = theme.accent
  ctx.font = 'bold 16px Arial'
  ctx.textAlign = 'left'
  ctx.fillText(`LVL ${state.level}`, 20, 60)
  
  // Level progress bar
  const progBarWidth = 80
  const progBarHeight = 6
  const progBarX = 70
  const progBarY = 52
  ctx.fillStyle = '#333'
  ctx.fillRect(progBarX, progBarY, progBarWidth, progBarHeight)
  ctx.fillStyle = theme.accent
  ctx.fillRect(progBarX, progBarY, progBarWidth * (state.levelProgress / 100), progBarHeight)
  ctx.strokeStyle = `${theme.accent}60`
  ctx.lineWidth = 1
  ctx.strokeRect(progBarX, progBarY, progBarWidth, progBarHeight)
  
  // Wave
  ctx.fillStyle = '#ffffff'
  ctx.font = '14px Arial'
  ctx.fillText(`Wave ${state.wave}`, 20, 80)
  
  // Score
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 24px Arial'
  ctx.textAlign = 'right'
  ctx.fillText(`${state.score}`, CANVAS_WIDTH - 20, 35)
  
  // High score
  ctx.fillStyle = '#888'
  ctx.font = '14px Arial'
  ctx.fillText(`BEST: ${state.highScore}`, CANVAS_WIDTH - 20, 55)
  
  // Theme name
  ctx.fillStyle = `${theme.accent}80`
  ctx.font = '12px Arial'
  ctx.textAlign = 'right'
  ctx.fillText(theme.name, CANVAS_WIDTH - 20, 75)
  
  // Combo
  if (player.combo > 1) {
    const comboAlpha = Math.min(1, state.comboTimer / 30)
    ctx.globalAlpha = comboAlpha
    ctx.fillStyle = theme.accent
    ctx.font = 'bold 32px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${player.combo}x COMBO`, CANVAS_WIDTH / 2, 50)
    ctx.globalAlpha = 1
  }
  
  // Enemies remaining
  if (state.isWaveActive) {
    ctx.fillStyle = '#888'
    ctx.font = '12px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(`Enemies: ${state.waveEnemiesRemaining}`, 20, 95)
  }
  
  // Perfect dodge indicator
  if (state.slowMoTimer > 0) {
    ctx.fillStyle = '#00ffff'
    ctx.font = 'bold 24px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('PERFECT DODGE!', CANVAS_WIDTH / 2, 100)
  }
}

function renderGameOver(ctx: CanvasRenderingContext2D, state: GameState, theme: typeof LEVEL_THEMES[0]) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  
  ctx.fillStyle = '#ff4444'
  ctx.font = 'bold 48px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80)
  
  ctx.fillStyle = '#ffffff'
  ctx.font = '20px Arial'
  ctx.fillText(`Level: ${state.level}  |  Wave: ${state.wave}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30)
  ctx.font = '28px Arial'
  ctx.fillText(`Score: ${state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10)
  
  if (state.score > state.highScore) {
    ctx.fillStyle = theme.accent
    ctx.font = 'bold 20px Arial'
    ctx.fillText('🏆 NEW HIGH SCORE! 🏆', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50)
  }
  
  ctx.fillStyle = '#888'
  ctx.font = '16px Arial'
  ctx.fillText('Press SPACE or click to restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100)
}

function renderLevelUp(ctx: CanvasRenderingContext2D, state: GameState, theme: typeof LEVEL_THEMES[0]) {
  const alpha = Math.min(1, state.levelUpTimer / 60)
  ctx.globalAlpha = alpha
  
  ctx.fillStyle = theme.accent
  ctx.font = 'bold 48px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(`LEVEL ${state.level}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20)
  
  ctx.fillStyle = '#ffffff'
  ctx.font = '24px Arial'
  ctx.fillText(theme.name, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
  
  if (state.level % 5 === 0) {
    ctx.fillStyle = '#ff4444'
    ctx.font = 'bold 18px Arial'
    ctx.fillText('❤️ +1 LIFE!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 55)
  }
  
  ctx.globalAlpha = 1
}

function renderWaveComplete(ctx: CanvasRenderingContext2D, state: GameState, theme: typeof LEVEL_THEMES[0]) {
  ctx.fillStyle = theme.accent
  ctx.font = 'bold 36px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(`WAVE ${state.wave} COMPLETE!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20)
  
  if (state.noHitWave) {
    ctx.fillStyle = '#00ffff'
    ctx.font = 'bold 20px Arial'
    ctx.fillText('PERFECT! +200', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
  }
  
  ctx.fillStyle = '#888'
  ctx.font = '16px Arial'
  ctx.fillText('Next wave incoming...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50)
}

function renderWaveStart(ctx: CanvasRenderingContext2D, state: GameState, theme: typeof LEVEL_THEMES[0]) {
  ctx.fillStyle = theme.accent
  ctx.font = 'bold 42px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(`WAVE ${state.wave}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
  
  if (state.wave % 10 === 0) {
    ctx.fillStyle = '#ff4444'
    ctx.font = 'bold 24px Arial'
    ctx.fillText('⚔️ BOSS WAVE ⚔️', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
  }
}

function renderGetReady(ctx: CanvasRenderingContext2D, theme: typeof LEVEL_THEMES[0]) {
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 36px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('GET READY!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
  
  ctx.fillStyle = '#888'
  ctx.font = '16px Arial'
  ctx.fillText('Enemies approach from the right', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 35)
  ctx.fillText('Slash projectiles to destroy them!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 55)
}
