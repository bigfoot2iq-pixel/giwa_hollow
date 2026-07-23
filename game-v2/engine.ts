// Game Engine - Core game logic

import {
  type GameState,
  type Player,
  type Enemy,
  type Controls,
  type EnemyType,
  type SlashEffect,
  type Particle,
  type Projectile,
  type ProjectileType,
  CANVAS_WIDTH,
  GROUND_Y,
  GRAVITY,
  PLAYER_START_X,
  PLAYER_SPEED,
  JUMP_FORCE,
  DODGE_SPEED,
  DODGE_DURATION,
  DODGE_COOLDOWN,
  ATTACK_DURATION,
  CHARGED_ATTACK_THRESHOLD,
  CHARGED_ATTACK_DURATION,
  COMBO_TIMEOUT,
  SLOWMO_DURATION,
  INVINCIBILITY_FRAMES,
  ENEMY_STATS,
  LEVEL_THEMES,
} from './types'

// Create initial player
function createPlayer(): Player {
  return {
    x: PLAYER_START_X,
    y: GROUND_Y - 80,
    velocityX: 0,
    velocityY: 0,
    width: 60,
    height: 80,
    state: 'idle',
    direction: 'right',
    lives: 3,
    isGrounded: true,
    frameX: 0,
    frameDelay: 6,
    frameDelayCount: 0,
    isAttacking: false,
    attackTimer: 0,
    attackHitboxActive: false,
    chargeTimer: 0,
    isCharging: false,
    isDodging: false,
    dodgeTimer: 0,
    dodgeCooldown: 0,
    isInvincible: false,
    invincibilityTimer: 0,
    combo: 0,
    comboTimer: 0,
  }
}

// Create initial game state
export function createInitialState(): GameState {
  return {
    player: createPlayer(),
    enemies: [],
    projectiles: [],
    slashEffects: [],
    particles: [],
    // Level system
    level: 1,
    levelProgress: 0,
    levelUpTimer: 0,
    // Wave system
    wave: 0,
    waveEnemiesRemaining: 0,
    waveEnemiesSpawned: 0,
    waveEnemiesTotal: 0,
    isWaveActive: false,
    waveStartTimer: 120,
    // Score
    score: 0,
    highScore: 0,
    // State
    gameOver: false,
    isPaused: false,
    screenShake: 0,
    slowMoTimer: 0,
    comboTimer: 0,
    nextEnemyId: 1,
    nextProjectileId: 1,
    spawnTimer: 0,
    perfectDodge: false,
    noHitWave: true,
  }
}

// Get difficulty multiplier based on level
function getDifficultyMultiplier(level: number): number {
  return 1 + (level - 1) * 0.15 // 15% increase per level
}

// Get wave configuration based on wave number and level
function getWaveConfig(wave: number, level: number): { enemies: EnemyType[], total: number } {
  const difficulty = getDifficultyMultiplier(level)
  const cycle = Math.floor((wave - 1) / 10)
  const waveInCycle = ((wave - 1) % 10) + 1
  
  let enemies: EnemyType[] = []
  let baseTotal = 3 + Math.floor(wave * 0.5) + cycle * 2
  
  // Earlier introduction of harder enemies at higher levels
  const levelBonus = Math.floor(level / 2)
  
  if (waveInCycle <= Math.max(1, 3 - levelBonus)) {
    enemies = ['goblin']
  } else if (waveInCycle <= Math.max(3, 6 - levelBonus)) {
    enemies = ['goblin', 'skeleton']
  } else if (waveInCycle <= 9) {
    enemies = ['goblin', 'skeleton', 'ninja']
  } else {
    // Boss wave
    enemies = ['samurai']
    if (level >= 3) enemies.push('ninja') // Add ninjas to boss waves at higher levels
    baseTotal = 1 + cycle + Math.floor(level / 3)
  }
  
  const total = Math.min(Math.floor(baseTotal * difficulty), 15) // Cap at 15 enemies
  
  return { enemies, total }
}

// Spawn enemy from the right with level-scaled stats
function spawnEnemy(state: GameState, type: EnemyType): Enemy {
  const baseStats = ENEMY_STATS[type]
  const difficulty = getDifficultyMultiplier(state.level)
  const isBoss = type === 'samurai'
  
  // Scale health with level
  const scaledHealth = Math.ceil(baseStats.health * difficulty)
  
  // Scale speed slightly
  const scaledSpeed = baseStats.speed * (1 + (state.level - 1) * 0.05)
  
  return {
    id: state.nextEnemyId,
    type,
    x: CANVAS_WIDTH + 50 + Math.random() * 100,
    y: GROUND_Y - (isBoss ? 90 : 70),
    width: isBoss ? 70 : 60,
    height: isBoss ? 90 : 70,
    velocityX: -scaledSpeed,
    health: scaledHealth,
    maxHealth: scaledHealth,
    isAttacking: false,
    isDying: false,
    deathTimer: 0,
    frameX: 0,
    frameDelay: 6,
    frameDelayCount: 0,
    attackCooldown: 0,
    throwCooldown: 0,
    isThrowing: false,
  }
}

// Create projectile
function createProjectile(enemy: Enemy, state: GameState): Projectile {
  const type: ProjectileType = enemy.type === 'ninja' ? 'shuriken' : 'bone'
  const stats = ENEMY_STATS[enemy.type]
  const speed = 'projectileSpeed' in stats ? stats.projectileSpeed : 5
  
  // Aim at player with slight prediction
  const dx = state.player.x - enemy.x
  const dy = (state.player.y + state.player.height / 2) - (enemy.y + enemy.height / 2)
  const dist = Math.sqrt(dx * dx + dy * dy)
  
  // Normalize and apply speed
  const vx = (dx / dist) * speed * -1 // Negative because enemies are on the right
  const vy = (dy / dist) * speed * 0.3 // Less vertical movement
  
  return {
    id: state.nextProjectileId,
    type,
    x: enemy.x,
    y: enemy.y + enemy.height / 2,
    velocityX: -speed, // Always move left towards player
    velocityY: vy,
    width: type === 'shuriken' ? 20 : 25,
    height: type === 'shuriken' ? 20 : 15,
    damage: 1,
    rotation: 0,
  }
}

// Create slash effect
function createSlashEffect(player: Player, isCharged: boolean): SlashEffect {
  const width = isCharged ? 150 : 80
  return {
    x: player.x + player.width / 2,
    y: player.y + 10,
    width,
    height: 60,
    timer: isCharged ? 15 : 10,
    isCharged,
  }
}

// Create particles
function createParticles(x: number, y: number, color: string, count: number): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      velocityX: (Math.random() - 0.5) * 8,
      velocityY: (Math.random() - 0.8) * 6,
      life: 30 + Math.random() * 20,
      maxLife: 50,
      color,
      size: 3 + Math.random() * 4,
    })
  }
  return particles
}

// Get current theme based on level
export function getCurrentTheme(level: number) {
  const themeIndex = (level - 1) % LEVEL_THEMES.length
  return LEVEL_THEMES[themeIndex]
}

// Main update function
export function updateGame(state: GameState, controls: Controls, deltaScale: number = 1): GameState {
  if (state.gameOver || state.isPaused) return state
  
  const newState = { ...state }
  
  // Apply slow-mo
  const timeScale = newState.slowMoTimer > 0 ? 0.3 : 1
  const dt = deltaScale * timeScale
  
  // Update timers
  if (newState.slowMoTimer > 0) newState.slowMoTimer--
  if (newState.screenShake > 0) newState.screenShake--
  if (newState.levelUpTimer > 0) newState.levelUpTimer--
  if (newState.comboTimer > 0) {
    newState.comboTimer--
    if (newState.comboTimer <= 0) newState.player.combo = 0
  }
  
  // Wave management
  newState.waveStartTimer--
  if (!newState.isWaveActive && newState.waveStartTimer <= 0) {
    // Start new wave
    newState.wave++
    const config = getWaveConfig(newState.wave, newState.level)
    newState.waveEnemiesTotal = config.total
    newState.waveEnemiesRemaining = config.total
    newState.waveEnemiesSpawned = 0
    newState.isWaveActive = true
    newState.noHitWave = true
    newState.spawnTimer = 60
  }
  
  // Spawn enemies during wave
  if (newState.isWaveActive && newState.waveEnemiesSpawned < newState.waveEnemiesTotal) {
    newState.spawnTimer--
    if (newState.spawnTimer <= 0) {
      const config = getWaveConfig(newState.wave, newState.level)
      const type = config.enemies[Math.floor(Math.random() * config.enemies.length)]
      const enemy = spawnEnemy(newState, type)
      newState.enemies.push(enemy)
      newState.nextEnemyId++
      newState.waveEnemiesSpawned++
      
      // Spawn delay - faster at higher levels
      const levelSpeedBonus = 1 - (newState.level - 1) * 0.05
      const baseDelay = Math.max(20, (90 - newState.wave * 3) * levelSpeedBonus)
      newState.spawnTimer = baseDelay + Math.random() * 20
    }
  }
  
  // Check wave complete
  if (newState.isWaveActive && newState.waveEnemiesRemaining <= 0) {
    newState.isWaveActive = false
    newState.waveStartTimer = 150
    newState.score += 5 // Wave clear bonus (reduced)
    if (newState.noHitWave) {
      newState.score += 10 // Perfect wave bonus (reduced)
    }
  }
  
  // Update player
  updatePlayer(newState, controls, dt)
  
  // Update enemies
  updateEnemies(newState, dt)
  
  // Update projectiles
  updateProjectiles(newState, dt)
  
  // Check collisions
  checkCollisions(newState)
  
  // Update effects
  updateEffects(newState)
  
  return newState
}

function updatePlayer(state: GameState, controls: Controls, dt: number) {
  const player = state.player
  
  // Update invincibility
  if (player.invincibilityTimer > 0) {
    player.invincibilityTimer--
    player.isInvincible = player.invincibilityTimer > 0
  }
  
  // Update dodge cooldown
  if (player.dodgeCooldown > 0) player.dodgeCooldown--
  
  // Handle dodge
  if (player.isDodging) {
    player.dodgeTimer--
    player.velocityX = -DODGE_SPEED * dt
    player.isInvincible = true
    
    if (player.dodgeTimer <= 0) {
      player.isDodging = false
      player.isInvincible = player.invincibilityTimer > 0
      player.dodgeCooldown = DODGE_COOLDOWN
    }
  } else if (!player.isAttacking) {
    // Movement
    player.velocityX = 0
    
    if (controls.left) {
      player.velocityX = -PLAYER_SPEED * dt
      player.direction = 'left'
    }
    if (controls.right) {
      player.velocityX = PLAYER_SPEED * dt
      player.direction = 'right'
    }
    
    // Jump
    if (controls.jump && player.isGrounded) {
      player.velocityY = JUMP_FORCE
      player.isGrounded = false
    }
    
    // Dodge
    if (controls.dodge && player.dodgeCooldown <= 0 && player.isGrounded) {
      player.isDodging = true
      player.dodgeTimer = DODGE_DURATION
      player.frameX = 0
    }
    
    // Attack
    if (controls.attack && !player.isCharging) {
      player.isCharging = true
      player.chargeTimer = 0
    }
  }
  
  // Charge attack
  if (player.isCharging && controls.attack) {
    player.chargeTimer++
  } else if (player.isCharging && !controls.attack) {
    const isCharged = player.chargeTimer >= CHARGED_ATTACK_THRESHOLD
    player.isAttacking = true
    player.attackTimer = isCharged ? CHARGED_ATTACK_DURATION : ATTACK_DURATION
    player.attackHitboxActive = true
    player.isCharging = false
    player.chargeTimer = 0
    player.frameX = 0
    player.direction = 'right'
    
    state.slashEffects.push(createSlashEffect(player, isCharged))
    
    if (isCharged) {
      state.screenShake = 8
    }
  }
  
  // Update attack
  if (player.isAttacking) {
    player.attackTimer--
    if (player.attackTimer <= 0) {
      player.isAttacking = false
      player.attackHitboxActive = false
    }
  }
  
  // Apply gravity
  player.velocityY += GRAVITY * dt
  
  // Update position
  player.x += player.velocityX
  player.y += player.velocityY
  
  // Ground collision
  if (player.y >= GROUND_Y - player.height) {
    player.y = GROUND_Y - player.height
    player.velocityY = 0
    player.isGrounded = true
  }
  
  // Boundary
  player.x = Math.max(20, Math.min(CANVAS_WIDTH - 200, player.x))
  
  // Update state
  if (player.isDodging) {
    player.state = 'dodge'
  } else if (player.isAttacking) {
    player.state = player.chargeTimer >= CHARGED_ATTACK_THRESHOLD ? 'chargedAttack' : 'attack'
  } else if (!player.isGrounded) {
    player.state = 'jump'
  } else if (Math.abs(player.velocityX) > 0.1) {
    player.state = 'run'
  } else {
    player.state = 'idle'
  }
  
  // Update animation frame
  player.frameDelayCount++
  if (player.frameDelayCount >= player.frameDelay) {
    player.frameDelayCount = 0
    player.frameX++
  }
}

function updateEnemies(state: GameState, dt: number) {
  const theme = getCurrentTheme(state.level)
  
  state.enemies = state.enemies.filter(enemy => {
    if (enemy.isDying) {
      enemy.deathTimer--
      return enemy.deathTimer > 0
    }
    
    const stats = ENEMY_STATS[enemy.type]
    const distToPlayer = state.player.x - enemy.x
    const absDistToPlayer = Math.abs(distToPlayer)
    
    // Update throw cooldown
    if (enemy.throwCooldown > 0) enemy.throwCooldown -= dt
    
    // Smart enemy behavior based on type
    if (enemy.type === 'ninja') {
      // Ninjas: Stay at range and throw shurikens
      const preferredRange = 250 + Math.random() * 100
      
      if (absDistToPlayer > preferredRange + 50) {
        // Move closer
        enemy.x += enemy.velocityX * dt
      } else if (absDistToPlayer < preferredRange - 50 && absDistToPlayer > stats.attackRange) {
        // Back off slightly
        enemy.x += Math.abs(enemy.velocityX) * dt * 0.5
      }
      
      // Throw shuriken
      if (enemy.throwCooldown <= 0 && absDistToPlayer < 400 && absDistToPlayer > 100) {
        const throwCooldown = 'throwCooldown' in stats ? stats.throwCooldown : 120
        enemy.throwCooldown = throwCooldown * (0.8 + Math.random() * 0.4)
        enemy.isThrowing = true
        
        const projectile = createProjectile(enemy, state)
        state.projectiles.push(projectile)
        state.nextProjectileId++
        
        // Particles for throw
        state.particles.push(...createParticles(enemy.x, enemy.y + enemy.height / 2, theme.accent, 5))
      }
      
      // Melee attack if very close
      if (absDistToPlayer <= stats.attackRange && enemy.attackCooldown <= 0) {
        enemy.isAttacking = true
        enemy.attackCooldown = 60
        enemy.frameX = 0
      }
      
    } else if (enemy.type === 'skeleton') {
      // Skeletons: Mix of ranged and melee, throw bones
      const throwRange = 300
      
      if (absDistToPlayer > stats.attackRange) {
        enemy.x += enemy.velocityX * dt
      }
      
      // Throw bone at medium range
      if (enemy.throwCooldown <= 0 && absDistToPlayer < throwRange && absDistToPlayer > stats.attackRange * 1.5) {
        const throwCooldown = 'throwCooldown' in stats ? stats.throwCooldown : 180
        enemy.throwCooldown = throwCooldown * (0.8 + Math.random() * 0.4)
        enemy.isThrowing = true
        
        const projectile = createProjectile(enemy, state)
        state.projectiles.push(projectile)
        state.nextProjectileId++
        
        state.particles.push(...createParticles(enemy.x, enemy.y + enemy.height / 2, '#aaaaaa', 5))
      }
      
      // Melee attack
      if (absDistToPlayer <= stats.attackRange && enemy.attackCooldown <= 0) {
        enemy.isAttacking = true
        enemy.attackCooldown = 70
        enemy.frameX = 0
      }
      
    } else {
      // Goblins and Samurai: Pure melee, rush the player
      if (!enemy.isAttacking && absDistToPlayer > stats.attackRange) {
        enemy.x += enemy.velocityX * dt
      }
      
      if (absDistToPlayer <= stats.attackRange && enemy.attackCooldown <= 0) {
        enemy.isAttacking = true
        enemy.attackCooldown = enemy.type === 'samurai' ? 50 : 60
        enemy.frameX = 0
      }
    }
    
    // Update attack cooldown
    if (enemy.attackCooldown > 0) enemy.attackCooldown -= dt
    
    // Update animation
    enemy.frameDelayCount++
    if (enemy.frameDelayCount >= enemy.frameDelay) {
      enemy.frameDelayCount = 0
      enemy.frameX++
      
      if (enemy.isAttacking && enemy.frameX >= 8) {
        enemy.isAttacking = false
        enemy.frameX = 0
      }
      if (enemy.isThrowing && enemy.frameX >= 4) {
        enemy.isThrowing = false
      }
    }
    
    return enemy.x > -100
  })
}

function updateProjectiles(state: GameState, dt: number) {
  state.projectiles = state.projectiles.filter(proj => {
    // Update position
    proj.x += proj.velocityX * dt
    proj.y += proj.velocityY * dt
    
    // Rotate shurikens
    if (proj.type === 'shuriken') {
      proj.rotation += 15 * dt
    } else {
      proj.rotation += 5 * dt
    }
    
    // Remove if off screen
    return proj.x > -50 && proj.x < CANVAS_WIDTH + 50 && proj.y > -50 && proj.y < GROUND_Y + 50
  })
}

function checkCollisions(state: GameState) {
  const player = state.player
  const theme = getCurrentTheme(state.level)
  
  // Player attack vs enemies
  if (player.attackHitboxActive) {
    const isCharged = state.slashEffects.some(e => e.isCharged && e.timer > 0)
    const attackWidth = isCharged ? 150 : 80
    const attackX = player.x + player.width / 2
    const attackY = player.y
    
    state.enemies.forEach(enemy => {
      if (enemy.isDying) return
      
      if (
        attackX < enemy.x + enemy.width &&
        attackX + attackWidth > enemy.x &&
        attackY < enemy.y + enemy.height &&
        attackY + 60 > enemy.y
      ) {
        enemy.health -= isCharged ? 3 : 1
        
        if (enemy.health <= 0) {
          enemy.isDying = true
          enemy.deathTimer = 30
          state.waveEnemiesRemaining--
          
          // Score with combo multiplier (reduced for slow progression)
          const stats = ENEMY_STATS[enemy.type]
          const comboMultiplier = 1 + (player.combo * 0.05) // Reduced from 0.25
          const levelBonus = 1 + (state.level - 1) * 0.02 // Reduced from 0.1
          state.score += Math.floor(stats.points * comboMultiplier * levelBonus)
          
          // Level progress - harder enemies give more progress
          const progressGain = stats.points / 2
          state.levelProgress += progressGain
          
          // Level up check
          if (state.levelProgress >= 100) {
            state.level++
            state.levelProgress = state.levelProgress - 100
            state.levelUpTimer = 180 // 3 seconds
            state.screenShake = 20
            // Bonus life every 5 levels
            if (state.level % 5 === 0 && player.lives < 5) {
              player.lives++
            }
          }
          
          player.combo++
          state.comboTimer = COMBO_TIMEOUT
          
          state.particles.push(...createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, theme.accent, 10))
          state.screenShake = 5
        } else {
          enemy.x += 30
          state.particles.push(...createParticles(enemy.x, enemy.y + enemy.height / 2, '#ff6b6b', 5))
        }
      }
    })
    
    // Player attack vs projectiles (can slash them!)
    state.projectiles = state.projectiles.filter(proj => {
      if (
        attackX < proj.x + proj.width &&
        attackX + attackWidth > proj.x &&
        attackY < proj.y + proj.height &&
        attackY + 60 > proj.y
      ) {
        // Destroyed projectile
        state.particles.push(...createParticles(proj.x, proj.y, theme.accent, 8))
        state.score += 1 // Reduced from 5
        return false
      }
      return true
    })
    
    player.attackHitboxActive = false
  }
  
  // Enemy attack vs player
  if (!player.isInvincible && !player.isDodging) {
    state.enemies.forEach(enemy => {
      if (enemy.isDying || !enemy.isAttacking) return
      
      const stats = ENEMY_STATS[enemy.type]
      const enemyAttackX = enemy.x - stats.attackRange
      
      if (
        player.x + player.width > enemyAttackX &&
        player.x < enemy.x + enemy.width &&
        player.y + player.height > enemy.y &&
        player.y < enemy.y + enemy.height
      ) {
        if (player.dodgeTimer > DODGE_DURATION - 5) {
          state.slowMoTimer = SLOWMO_DURATION
          state.perfectDodge = true
          state.score += 3 // Reduced from 50
          state.particles.push(...createParticles(player.x + player.width, player.y + player.height / 2, '#00ffff', 15))
        } else {
          playerTakeDamage(state)
        }
      }
    })
  }
  
  // Projectile vs player
  if (!player.isInvincible && !player.isDodging) {
    state.projectiles = state.projectiles.filter(proj => {
      if (
        player.x < proj.x + proj.width &&
        player.x + player.width > proj.x &&
        player.y < proj.y + proj.height &&
        player.y + player.height > proj.y
      ) {
        // Check for perfect dodge
        if (player.dodgeTimer > DODGE_DURATION - 5) {
          state.slowMoTimer = SLOWMO_DURATION
          state.perfectDodge = true
          state.score += 3 // Reduced from 50
          state.particles.push(...createParticles(proj.x, proj.y, '#00ffff', 10))
        } else {
          playerTakeDamage(state)
          state.particles.push(...createParticles(proj.x, proj.y, '#ff0000', 8))
        }
        return false
      }
      return true
    })
  }
}

function playerTakeDamage(state: GameState) {
  const player = state.player
  const theme = getCurrentTheme(state.level)
  
  player.lives--
  player.isInvincible = true
  player.invincibilityTimer = INVINCIBILITY_FRAMES
  player.combo = 0
  state.comboTimer = 0
  state.noHitWave = false
  state.screenShake = 15
  state.particles.push(...createParticles(player.x + player.width / 2, player.y + player.height / 2, '#ff0000', 20))
  
  if (player.lives <= 0) {
    state.gameOver = true
  }
}

function updateEffects(state: GameState) {
  state.slashEffects = state.slashEffects.filter(effect => {
    effect.timer--
    return effect.timer > 0
  })
  
  state.particles = state.particles.filter(particle => {
    particle.x += particle.velocityX
    particle.y += particle.velocityY
    particle.velocityY += 0.2
    particle.life--
    return particle.life > 0
  })
}

// Reset game
export function resetGame(state: GameState): GameState {
  const newState = createInitialState()
  newState.highScore = Math.max(state.highScore, state.score)
  return newState
}
