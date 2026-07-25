// Game V2 Types - ARIWA: Last Stand

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

// Level themes with colors — GIWA-blue cohesive palette.
// Dark backgrounds keep the chibi + enemies readable; bright brand-adjacent
// accents drive the glow-heavy renderer. Blue spine with tasteful variety.
export const LEVEL_THEMES = [
  { name: 'Azure Keep',   bgTop: '#060b1c', bgMid: '#0d2350', bgBottom: '#060b1c', accent: '#4c8dff', ground: '#10203f' },
  { name: 'Cobalt Deep',  bgTop: '#05081a', bgMid: '#0a1b45', bgBottom: '#05081a', accent: '#0062df', ground: '#0c1836' },
  { name: 'Frost Reach',  bgTop: '#041018', bgMid: '#06304a', bgBottom: '#041018', accent: '#38bdf8', ground: '#0a2838' },
  { name: 'Twilight',     bgTop: '#0a0620', bgMid: '#241a55', bgBottom: '#0a0620', accent: '#7c7bff', ground: '#1a1442' },
  { name: 'Teal Tide',    bgTop: '#04140f', bgMid: '#0a3a3a', bgBottom: '#04140f', accent: '#2dd4bf', ground: '#0a2a2a' },
  { name: 'Ember Gate',   bgTop: '#140a08', bgMid: '#3a1a12', bgBottom: '#140a08', accent: '#ff8a4c', ground: '#2a1610' },
  { name: 'The Void',     bgTop: '#04060c', bgMid: '#0a1020', bgBottom: '#04060c', accent: '#dbe7ff', ground: '#0e1626' },
  { name: 'Royal Temple', bgTop: '#0a0a18', bgMid: '#1a2350', bgBottom: '#0a0a18', accent: '#ffcf5c', ground: '#14183a' },
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
