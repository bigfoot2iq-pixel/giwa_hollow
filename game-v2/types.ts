// Game V2 Types - The Hollow: Last Stand

export const CANVAS_WIDTH = 800
export const CANVAS_HEIGHT = 450
export const GROUND_Y = 350
export const GRAVITY = 0.6
export const PLAYER_START_X = 150

// Player constants
export const PLAYER_SPEED = 4
export const JUMP_FORCE = -14
export const DODGE_SPEED = 8
export const DODGE_DURATION = 20 // frames
export const DODGE_COOLDOWN = 30 // frames
export const ATTACK_DURATION = 15 // frames
export const CHARGED_ATTACK_THRESHOLD = 30 // frames to hold for charged attack
export const CHARGED_ATTACK_DURATION = 25 // frames
export const COMBO_TIMEOUT = 90 // frames before combo resets
export const SLOWMO_DURATION = 60 // frames
export const INVINCIBILITY_FRAMES = 45 // after getting hit

// Animation data
export const ANIMATIONS = {
  playerIdle: { src: '/images/idle.png', frames: 10, width: 50, height: 50 },
  playerRun: { src: '/images/run.png', frames: 16, width: 50, height: 50 },
  playerAttack: { src: '/images/attack.png', frames: 7, width: 50, height: 50 },
  playerHurt: { src: '/images/hurt.png', frames: 4, width: 50, height: 50 },
  goblinRun: { src: '/images/goblin-run.png', frames: 8, width: 40, height: 40 },
  goblinAttack: { src: '/images/goblin-attack.png', frames: 8, width: 40, height: 40 },
  skeletonWalk: { src: '/images/skeleton-walk.png', frames: 10, width: 40, height: 40 },
  skeletonAttack: { src: '/images/skeleton-attack.png', frames: 10, width: 40, height: 40 },
  ninjaWalk: { src: '/images/yellow-ninja-walk.png', frames: 10, width: 40, height: 40 },
  ninjaAttack: { src: '/images/yellow-ninja-attack.png', frames: 20, width: 40, height: 40 },
  samuraiRun: { src: '/images/samurai-run.png', frames: 8, width: 50, height: 50 },
  samuraiAttack: { src: '/images/samurai-attack.png', frames: 4, width: 50, height: 50 },
}

// Enemy stats - base values, scaled by level
// Points are intentionally low to make score progression feel slow and rewarding
export const ENEMY_STATS = {
  goblin: { health: 1, speed: 2, damage: 1, points: 1, attackRange: 50, canThrow: false },
  skeleton: { health: 2, speed: 1.5, damage: 1, points: 2, attackRange: 60, canThrow: true, throwCooldown: 180, projectileSpeed: 4 },
  ninja: { health: 1, speed: 4, damage: 1, points: 3, attackRange: 55, canThrow: true, throwCooldown: 120, projectileSpeed: 7 },
  samurai: { health: 5, speed: 2.5, damage: 1, points: 10, attackRange: 70, canThrow: false },
}

export type EnemyType = keyof typeof ENEMY_STATS

export type PlayerState = 'idle' | 'run' | 'jump' | 'attack' | 'chargedAttack' | 'dodge' | 'hurt'

// Level themes with colors
export const LEVEL_THEMES = [
  { name: 'The Hollow', bgTop: '#0a0e1a', bgMid: '#1a1f2e', bgBottom: '#0a0e1a', accent: '#f6ff0d', ground: '#2a2f3e' },
  { name: 'Blood Moon', bgTop: '#1a0a0a', bgMid: '#2e1a1a', bgBottom: '#1a0a0a', accent: '#ff4444', ground: '#3e2a2a' },
  { name: 'Frozen Depths', bgTop: '#0a1a1a', bgMid: '#1a2e3e', bgBottom: '#0a1a1a', accent: '#44ffff', ground: '#2a3e4e' },
  { name: 'Cursed Forest', bgTop: '#0a1a0a', bgMid: '#1a2e1a', bgBottom: '#0a1a0a', accent: '#44ff44', ground: '#2a3e2a' },
  { name: 'Shadow Realm', bgTop: '#0a0a1a', bgMid: '#1a1a3e', bgBottom: '#0a0a1a', accent: '#aa44ff', ground: '#2a2a4e' },
  { name: 'Inferno', bgTop: '#1a0a00', bgMid: '#3e1a0a', bgBottom: '#1a0a00', accent: '#ff8844', ground: '#4e2a1a' },
  { name: 'Void', bgTop: '#050508', bgMid: '#0a0a10', bgBottom: '#050508', accent: '#ffffff', ground: '#1a1a2a' },
  { name: 'Golden Temple', bgTop: '#1a1a0a', bgMid: '#2e2e1a', bgBottom: '#1a1a0a', accent: '#ffdd44', ground: '#3e3e2a' },
]

export interface Player {
  x: number
  y: number
  velocityX: number
  velocityY: number
  width: number
  height: number
  state: PlayerState
  direction: 'left' | 'right'
  lives: number
  isGrounded: boolean
  // Animation
  frameX: number
  frameDelay: number
  frameDelayCount: number
  // Combat
  isAttacking: boolean
  attackTimer: number
  attackHitboxActive: boolean
  chargeTimer: number
  isCharging: boolean
  // Dodge
  isDodging: boolean
  dodgeTimer: number
  dodgeCooldown: number
  isInvincible: boolean
  invincibilityTimer: number
  // Combo
  combo: number
  comboTimer: number
}

export interface Enemy {
  id: number
  type: EnemyType
  x: number
  y: number
  width: number
  height: number
  velocityX: number
  health: number
  maxHealth: number
  isAttacking: boolean
  isDying: boolean
  deathTimer: number
  frameX: number
  frameDelay: number
  frameDelayCount: number
  attackCooldown: number
  // Projectile throwing
  throwCooldown: number
  isThrowing: boolean
}

export type ProjectileType = 'shuriken' | 'bone'

export interface Projectile {
  id: number
  type: ProjectileType
  x: number
  y: number
  velocityX: number
  velocityY: number
  width: number
  height: number
  damage: number
  rotation: number
}

export interface SlashEffect {
  x: number
  y: number
  width: number
  height: number
  timer: number
  isCharged: boolean
}

export interface Particle {
  x: number
  y: number
  velocityX: number
  velocityY: number
  life: number
  maxLife: number
  color: string
  size: number
}

export interface GameState {
  player: Player
  enemies: Enemy[]
  projectiles: Projectile[]
  slashEffects: SlashEffect[]
  particles: Particle[]
  // Level system
  level: number
  levelProgress: number // 0-100, fills up as you kill enemies
  levelUpTimer: number // Show level up message
  // Wave system
  wave: number
  waveEnemiesRemaining: number
  waveEnemiesSpawned: number
  waveEnemiesTotal: number
  isWaveActive: boolean
  waveStartTimer: number
  // Score
  score: number
  highScore: number
  // State
  gameOver: boolean
  isPaused: boolean
  screenShake: number
  slowMoTimer: number
  comboTimer: number
  nextEnemyId: number
  nextProjectileId: number
  spawnTimer: number
  perfectDodge: boolean
  noHitWave: boolean
}

export interface Controls {
  left: boolean
  right: boolean
  jump: boolean
  attack: boolean
  dodge: boolean
}
