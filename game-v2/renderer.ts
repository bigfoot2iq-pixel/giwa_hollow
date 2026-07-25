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
  ATTACK_DURATION,
  CHARGED_ATTACK_DURATION,
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

  const time = Date.now() * 0.001

  // Far parallax layer — slow, dim, larger dots for depth
  ctx.fillStyle = `${theme.accent}20`
  for (let i = 0; i < 18; i++) {
    const x = (i * 211 + time * (4 + (i % 3))) % CANVAS_WIDTH
    const y = (i * 97) % (GROUND_Y - 80)
    const size = 2 + (i % 2) * 2
    ctx.fillRect(x, y, size, size)
  }

  // Near drift layer — faster, brighter sparks
  ctx.fillStyle = `${theme.accent}55`
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
  horizonGlow.addColorStop(0, `${theme.accent}22`)
  horizonGlow.addColorStop(1, `${theme.accent}00`)
  ctx.fillStyle = horizonGlow
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  // Vignette — darken edges to focus the action
  const vignette = ctx.createRadialGradient(
    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.35,
    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.7
  )
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = vignette
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

  // Perspective grid on the floor (subtle, scrolling)
  const scroll = (Date.now() * 0.03) % 40
  ctx.strokeStyle = `${theme.accent}18`
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let gx = -scroll; gx < CANVAS_WIDTH; gx += 40) {
    // fan lines outward from a vanishing point for a floor feel
    const vp = CANVAS_WIDTH / 2
    const bottomX = vp + (gx - vp) * 2.2
    ctx.moveTo(gx, GROUND_Y)
    ctx.lineTo(bottomX, CANVAS_HEIGHT)
  }
  ctx.stroke()
  // horizontal depth lines
  ctx.beginPath()
  for (let i = 1; i <= 3; i++) {
    const y = GROUND_Y + i * i * 8
    if (y < CANVAS_HEIGHT) { ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y) }
  }
  ctx.stroke()

  // Ground line with theme glow
  ctx.strokeStyle = `${theme.accent}aa`
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

// ── Chibi samurai (hand-drawn, no sprite) ──────────────────────────────────
// A cute-but-fierce GIWA mascot: big rounded head, large expressive eyes, blue
// lacquered armor with gold accents and a fluttering theme-tinted cape. Every
// plate gets a soft top-light gradient + clean dark outline so the figure reads
// like a polished sticker rather than flat shapes.
const ARMOR = '#1f6fe5'
const ARMOR_DARK = '#0a3f9e'
const ARMOR_LIGHT = '#7db4ff'
const ARMOR_HILITE = '#c7e0ff'
const STEEL = '#eef4ff'
const GOLD = '#ffd36b'
const GOLD_DARK = '#c9871f'
const INK = '#091023'          // clean dark outline / dark accents
const CLOTH = '#0f1830'        // hakama / under-suit
const SKIN = '#ffe0c2'         // face
const SKIN_SHADE = '#f0b892'   // face side-shade for roundness
const BLUSH = '#ff9aa6'
const MOUTH = '#7a3b46'
const EYE = '#0c1b3a'          // iris
const EYE_SHINE = '#9ad8ff'    // glowing catch-light

// Chibi is hand-drawn ~110px tall (feet→crest) but the hitbox is 80px.
// Scale the whole figure down so it sits inside the hitbox and reads as a
// tidy, proportioned fighter rather than an oversized sprite.
const PLAYER_DRAW_SCALE = 0.72

// Rounded-rect path helper (no fill — caller fills/strokes).
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

interface ChibiPose {
  legSwing: number      // -1..1 run stride
  swordAngle: number    // radians, 0 = forward horizontal, negative = raised
  obi: string           // belt / cape colour (theme accent)
  charged: boolean      // charged-attack glow on blade + crest
  hurt: boolean         // red tint on body
  flutter: number       // cape sway
}

// Draws the samurai in local coords: origin = between the feet, up = -y.
function drawChibiSamurai(ctx: CanvasRenderingContext2D, pose: ChibiPose) {
  const { legSwing, swordAngle, obi, charged, flutter } = pose

  // Vertical gradient helper — gives every armor plate metallic top-light depth.
  const vgrad = (y: number, h: number, top: string, bottom: string) => {
    const g = ctx.createLinearGradient(0, y, 0, y + h)
    g.addColorStop(0, top)
    g.addColorStop(1, bottom)
    return g
  }
  // Strokes the *current* path with the ink outline for a clean sticker edge.
  const outline = (w = 1.5) => { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.stroke() }

  // ── Cape / scarf (flutters behind, trails away from facing dir = -x) ──
  const capeGrad = ctx.createLinearGradient(-24, -60, -4, -18)
  capeGrad.addColorStop(0, obi)
  capeGrad.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = capeGrad
  ctx.beginPath()
  ctx.moveTo(-5, -62)
  ctx.quadraticCurveTo(-22 - flutter, -52, -18 + flutter * 0.6, -22)
  ctx.quadraticCurveTo(-13, -14, -4, -28)
  ctx.quadraticCurveTo(-9, -46, -5, -62)
  ctx.closePath(); ctx.fill()
  ctx.save(); ctx.globalAlpha = 0.5; outline(1); ctx.restore()

  // ── Back arm (behind torso) ──
  ctx.fillStyle = vgrad(-48, 20, ARMOR, ARMOR_DARK)
  rr(ctx, -18, -48, 7, 20, 3.5); ctx.fill(); outline(1.2)

  // ── Legs (cloth thigh + suneate shin guard + sabaton) ──
  const drawLeg = (x: number, lift: number) => {
    ctx.fillStyle = CLOTH
    rr(ctx, x, -28, 10, 14 - lift, 4); ctx.fill()
    ctx.fillStyle = vgrad(-18, 14, ARMOR_LIGHT, ARMOR_DARK)
    rr(ctx, x + 0.5, -18, 9, 14 - lift, 3); ctx.fill(); outline(1)
    ctx.fillStyle = '#070c16'                 // boot
    rr(ctx, x - 1.5, -5 - lift, 13, 6, 3); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.3)'   // toe highlight
    rr(ctx, x - 1.5, -5 - lift, 13, 1.6, 1); ctx.fill()
  }
  drawLeg(-11 + legSwing * 4, Math.max(0, -legSwing) * 4)   // back leg
  drawLeg(2 - legSwing * 4, Math.max(0, legSwing) * 4)      // front leg

  // ── Kusazuri (armored skirt over hips) ──
  ctx.fillStyle = vgrad(-32, 14, ARMOR, ARMOR_DARK)
  rr(ctx, -15, -32, 30, 14, 5); ctx.fill(); outline(1.2)
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1
  for (const ly of [-28, -24]) {
    ctx.beginPath(); ctx.moveTo(-13, ly); ctx.lineTo(13, ly); ctx.stroke()
  }

  // ── Torso (dō cuirass) ──
  ctx.fillStyle = vgrad(-58, 30, ARMOR_HILITE, ARMOR_DARK)
  rr(ctx, -16, -58, 32, 30, 10); ctx.fill(); outline(1.5)
  ctx.fillStyle = 'rgba(255,255,255,0.16)'   // sheen
  rr(ctx, -12, -55, 8, 24, 4); ctx.fill()
  // lamellar lacing rows (kozane)
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1
  for (const ly of [-50, -44, -38]) {
    ctx.beginPath(); ctx.moveTo(-14, ly); ctx.lineTo(14, ly); ctx.stroke()
  }
  // brand "hollow" ring emblem (gold)
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(0, -47, 3.6, 0, Math.PI * 2); ctx.stroke()

  // ── Obi belt (theme-tinted sash + knot) ──
  ctx.fillStyle = obi
  rr(ctx, -16, -34, 32, 6, 3); ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  rr(ctx, -16, -30, 32, 2, 1); ctx.fill()
  ctx.fillStyle = obi
  rr(ctx, -4, -35, 8, 12, 3); ctx.fill()

  // ── Sode pauldrons (layered shoulder plates) ──
  for (const sx of [-16, 16]) {
    ctx.fillStyle = vgrad(-56, 12, ARMOR, ARMOR_DARK)
    ctx.beginPath(); ctx.ellipse(sx, -52, 9, 8, 0, 0, Math.PI * 2); ctx.fill(); outline(1.2)
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.beginPath(); ctx.ellipse(sx, -55, 5, 3, 0, 0, Math.PI * 2); ctx.fill()
  }

  // ── Neck guard ──
  ctx.fillStyle = ARMOR_DARK
  rr(ctx, -7, -62, 14, 8, 3); ctx.fill()

  // ── Head (big cute head with an expressive face) ──
  ctx.fillStyle = SKIN
  rr(ctx, -14, -84, 28, 30, 13); ctx.fill(); outline(1.5)
  // side shade for roundness (clipped to the face)
  ctx.save()
  rr(ctx, -14, -84, 28, 30, 13); ctx.clip()
  ctx.fillStyle = SKIN_SHADE
  rr(ctx, 7, -84, 7, 30, 6); ctx.fill()
  ctx.restore()
  // chin guard (menpo) — small metal piece keeps the warrior feel
  ctx.fillStyle = vgrad(-60, 8, '#33405e', '#141d30')
  rr(ctx, -11, -60, 22, 8, 4); ctx.fill(); outline(1)
  // brim shadow (mabisashi) falling over the eyes
  ctx.fillStyle = 'rgba(8,14,28,0.32)'
  rr(ctx, -13, -76, 26, 5, 2.5); ctx.fill()
  // blush
  ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = BLUSH
  ctx.beginPath(); ctx.ellipse(-9, -61, 2.8, 1.8, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(9, -61, 2.8, 1.8, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  // big cute eyes with glowing catch-light
  for (const sx of [-6, 6]) {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.ellipse(sx, -66, 3.6, 4.6, 0, 0, Math.PI * 2); ctx.fill()
    ctx.save()
    ctx.shadowColor = EYE_SHINE; ctx.shadowBlur = charged ? 8 : 4
    ctx.fillStyle = EYE
    ctx.beginPath(); ctx.ellipse(sx, -65, 2.6, 3.5, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    ctx.fillStyle = EYE_SHINE
    ctx.beginPath(); ctx.ellipse(sx - 0.9, -66.5, 1.2, 1.4, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.arc(sx + 1, -64, 0.7, 0, Math.PI * 2); ctx.fill()
  }
  // determined little eyebrows
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-9, -72.5); ctx.lineTo(-3.5, -71); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(9, -72.5); ctx.lineTo(3.5, -71); ctx.stroke()
  // tiny confident smile
  ctx.strokeStyle = MOUTH; ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.moveTo(-2.5, -58); ctx.quadraticCurveTo(0, -56, 2.5, -58); ctx.stroke()
  ctx.lineCap = 'butt'

  // ── Kabuto helmet dome ──
  ctx.fillStyle = vgrad(-94, 26, ARMOR_HILITE, ARMOR)
  rr(ctx, -17, -94, 34, 26, 15); ctx.fill(); outline(1.5)
  ctx.fillStyle = 'rgba(255,255,255,0.3)'             // ridge sheen
  rr(ctx, -12, -92, 10, 7, 3); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1  // tehen centre ridge
  ctx.beginPath(); ctx.moveTo(0, -92); ctx.lineTo(0, -72); ctx.stroke()
  ctx.fillStyle = ARMOR_DARK                           // mabisashi visor brim
  rr(ctx, -20, -78, 40, 6, 3); ctx.fill(); outline(1)
  for (const sx of [-21, 16]) {                        // fukigaeshi side wings
    ctx.fillStyle = ARMOR_DARK
    rr(ctx, sx, -80, 5, 11, 2); ctx.fill()
    ctx.fillStyle = GOLD
    ctx.beginPath(); ctx.arc(sx + 2.5, -75, 1.5, 0, Math.PI * 2); ctx.fill()
  }
  // maedate crest (golden kuwagata horns)
  if (charged) { ctx.shadowColor = obi; ctx.shadowBlur = 12 }
  ctx.fillStyle = GOLD
  ctx.beginPath()
  ctx.moveTo(-8, -90)
  ctx.quadraticCurveTo(-12, -110, -3, -98)
  ctx.quadraticCurveTo(0, -102, 3, -98)
  ctx.quadraticCurveTo(12, -110, 8, -90)
  ctx.quadraticCurveTo(0, -95, -8, -90)
  ctx.closePath(); ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = GOLD_DARK; ctx.lineWidth = 1; ctx.stroke()
  ctx.fillStyle = GOLD
  ctx.beginPath(); ctx.arc(0, -90, 2.4, 0, Math.PI * 2); ctx.fill()  // kuwagata mount

  // ── Lead arm + katana (rotates on swing) ──
  ctx.save()
  ctx.translate(12, -50)   // lead shoulder
  ctx.rotate(swordAngle)
  // upper arm
  ctx.fillStyle = vgrad(-3, 6, ARMOR_LIGHT, ARMOR_DARK)
  rr(ctx, 0, -3, 14, 6, 3); ctx.fill(); outline(1)
  // wrist
  ctx.fillStyle = '#0a0f1c'
  ctx.beginPath(); ctx.arc(14, 0, 3.4, 0, Math.PI * 2); ctx.fill()
  // tsuka (wrapped handle)
  ctx.fillStyle = INK
  rr(ctx, 9, -1.8, 9, 3.6, 1.5); ctx.fill()
  ctx.strokeStyle = GOLD; ctx.lineWidth = 0.8
  for (const hx of [11, 14, 17]) {
    ctx.beginPath(); ctx.moveTo(hx, -1.8); ctx.lineTo(hx - 1.4, 1.8); ctx.stroke()
  }
  // tsuba guard
  ctx.fillStyle = GOLD
  rr(ctx, 18, -4.5, 3, 9, 1); ctx.fill()
  // curved blade — always faintly lit, brighter when charged
  ctx.shadowColor = charged ? obi : 'rgba(150,200,255,0.6)'
  ctx.shadowBlur = charged ? 14 : 5
  ctx.fillStyle = STEEL
  ctx.beginPath()
  ctx.moveTo(21, -2.4)
  ctx.quadraticCurveTo(38, -4.4, 52, -1.2)   // spine
  ctx.lineTo(54, 0.4)                         // tip
  ctx.quadraticCurveTo(38, 1.6, 21, 2)        // edge
  ctx.closePath(); ctx.fill()
  ctx.shadowBlur = 0
  // hamon edge line
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(22, 0.6); ctx.quadraticCurveTo(38, 1.0, 51, -0.2); ctx.stroke()
  ctx.restore()
}

function renderPlayer(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  _images: Record<string, HTMLImageElement>,
  theme: typeof LEVEL_THEMES[0]
) {
  const { player } = state
  const t = Date.now() / 1000
  const moving = Math.abs(player.velocityX) > 0.1
  const charged = player.state === 'chargedAttack'

  // Pose + animation
  let bob = 0
  let lean = 0
  let legSwing = 0
  let squashX = 1
  let stretchY = 1

  if (!player.isGrounded) {
    const goingUp = player.velocityY < 0
    stretchY = goingUp ? 1.08 : 0.95
    squashX = goingUp ? 0.94 : 1.06
    legSwing = goingUp ? -0.55 : 0.35
    lean = 0.06
  } else if (player.isDodging) {
    lean = 0.32
    bob = -2
    legSwing = 0.6
  } else if (player.isAttacking) {
    const dur = charged ? CHARGED_ATTACK_DURATION : ATTACK_DURATION
    const p = 1 - player.attackTimer / dur
    lean = 0.12 + p * 0.12
  } else if (moving) {
    legSwing = Math.sin(t * 12)
    bob = -Math.abs(Math.sin(t * 12)) * 3
    lean = 0.1
  } else {
    bob = Math.sin(t * 3) * 1.5
  }

  // Sword angle (0 = forward horizontal, negative = raised)
  let swordAngle: number
  if (player.isAttacking) {
    const dur = charged ? CHARGED_ATTACK_DURATION : ATTACK_DURATION
    const p = 1 - player.attackTimer / dur
    const eased = 1 - Math.pow(1 - p, 3)
    swordAngle = (charged ? -2.6 : -2.2) + eased * (charged ? 3.4 : 3.0)
  } else if (player.isCharging) {
    swordAngle = -2.3 + Math.sin(t * 10) * 0.06
  } else if (moving) {
    swordAngle = -0.35 + Math.sin(t * 12) * 0.15
  } else {
    swordAngle = -0.45 + Math.sin(t * 3) * 0.08
  }

  const footX = player.x + player.width / 2
  const footY = player.y + player.height
  const flutter = Math.sin(t * 7) * 3 + (moving ? Math.abs(legSwing) * 2 : 0) + (charged ? 2 : 0)
  const pose: ChibiPose = { legSwing, swordAngle, obi: theme.accent, charged, hurt: player.isInvincible, flutter }

  // Soft contact shadow grounds the figure (world coords, unaffected by bob)
  ctx.save()
  ctx.globalAlpha = 0.3
  ctx.fillStyle = '#000000'
  const shadowScale = player.isGrounded ? 1 : 0.6
  ctx.beginPath()
  ctx.ellipse(footX, footY - 1, 22 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()

  // Invincibility flash
  if (player.isInvincible && Math.floor(player.invincibilityTimer / 4) % 2 === 0) {
    ctx.globalAlpha = 0.5
  }

  // Anchor at the feet, face movement direction
  ctx.translate(footX, footY + bob)
  if (player.direction === 'left') ctx.scale(-1, 1)
  ctx.scale(squashX * PLAYER_DRAW_SCALE, stretchY * PLAYER_DRAW_SCALE)
  // Lean pivots around mid-body
  ctx.translate(0, -24)
  ctx.rotate(lean)
  ctx.translate(0, 24)

  // Charging glow around whole body
  if (player.isCharging && player.chargeTimer > 10) {
    ctx.shadowColor = theme.accent
    ctx.shadowBlur = 18 * Math.min(1, player.chargeTimer / CHARGED_ATTACK_THRESHOLD)
  }

  // Dodge after-image
  if (player.isDodging) {
    ctx.save()
    ctx.globalAlpha *= 0.35
    ctx.translate(6, 0)
    drawChibiSamurai(ctx, pose)
    ctx.restore()
  }

  drawChibiSamurai(ctx, pose)

  // Hurt tint
  if (player.isInvincible) {
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = 'rgba(255, 60, 60, 0.28)'
    ctx.fillRect(-34, -114, 68, 120)
    ctx.globalCompositeOperation = 'source-over'
  }

  ctx.restore()

  // Charge indicator bar (world coords)
  if (player.isCharging) {
    const chargeProgress = Math.min(1, player.chargeTimer / CHARGED_ATTACK_THRESHOLD)
    const barWidth = 50
    const barHeight = 6
    const barX = player.x + player.width / 2 - barWidth / 2
    const barY = player.y - 24

    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    rr(ctx, barX - 2, barY - 2, barWidth + 4, barHeight + 4, 3)
    ctx.fill()

    ctx.fillStyle = chargeProgress >= 1 ? theme.accent : 'rgba(255,255,255,0.55)'
    rr(ctx, barX, barY, barWidth * chargeProgress, barHeight, 3)
    ctx.fill()

    if (chargeProgress >= 1) {
      ctx.strokeStyle = theme.accent
      ctx.lineWidth = 2
      rr(ctx, barX - 2, barY - 2, barWidth + 4, barHeight + 4, 3)
      ctx.stroke()
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

  ctx.save()
  // Soft drop shadow keeps HUD readable across every theme
  ctx.shadowColor = 'rgba(0,0,0,0.65)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 1

  // Lives (hearts)
  for (let i = 0; i < Math.max(3, player.lives); i++) {
    const x = 20 + i * 35
    const y = 20
    const filled = i < player.lives

    ctx.fillStyle = filled ? '#ff5a6a' : 'rgba(255,255,255,0.18)'
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

  // Level progress bar (shadowless so it stays crisp)
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  const progBarWidth = 80
  const progBarHeight = 6
  const progBarX = 70
  const progBarY = 52
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  rr(ctx, progBarX, progBarY, progBarWidth, progBarHeight, 3); ctx.fill()
  ctx.fillStyle = theme.accent
  rr(ctx, progBarX, progBarY, progBarWidth * (state.levelProgress / 100), progBarHeight, 3); ctx.fill()
  ctx.strokeStyle = `${theme.accent}80`
  ctx.lineWidth = 1
  rr(ctx, progBarX, progBarY, progBarWidth, progBarHeight, 3); ctx.stroke()

  // Restore text shadow for remaining labels
  ctx.shadowColor = 'rgba(0,0,0,0.65)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 1

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
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '14px Arial'
  ctx.fillText(`BEST: ${state.highScore}`, CANVAS_WIDTH - 20, 55)

  // Theme name
  ctx.fillStyle = theme.accent
  ctx.font = 'bold 12px Arial'
  ctx.textAlign = 'right'
  ctx.fillText(theme.name.toUpperCase(), CANVAS_WIDTH - 20, 75)

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
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '12px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(`Enemies: ${state.waveEnemiesRemaining}`, 20, 95)
  }

  // Perfect dodge indicator
  if (state.slowMoTimer > 0) {
    ctx.fillStyle = '#4cf0ff'
    ctx.font = 'bold 24px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('PERFECT DODGE!', CANVAS_WIDTH / 2, 100)
  }

  ctx.restore()
}

function renderGameOver(ctx: CanvasRenderingContext2D, state: GameState, theme: typeof LEVEL_THEMES[0]) {
  // Themed dim backdrop
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
  g.addColorStop(0, 'rgba(4,8,20,0.9)')
  g.addColorStop(1, 'rgba(0,0,0,0.9)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  // accent hairline framing
  ctx.strokeStyle = `${theme.accent}55`
  ctx.lineWidth = 1
  ctx.strokeRect(24, 24, CANVAS_WIDTH - 48, CANVAS_HEIGHT - 48)

  ctx.fillStyle = '#ff5a6a'
  ctx.font = 'bold 48px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80)

  ctx.fillStyle = '#ffffff'
  ctx.font = '20px Arial'
  ctx.fillText(`Level: ${state.level}  |  Wave: ${state.wave}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30)
  ctx.font = 'bold 28px Arial'
  ctx.fillText(`Score: ${state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10)

  if (state.score > state.highScore) {
    ctx.fillStyle = theme.accent
    ctx.font = 'bold 20px Arial'
    ctx.fillText('🏆 NEW HIGH SCORE! 🏆', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50)
  }

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '16px Arial'
  ctx.fillText('Press SPACE or click to restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100)
}

function renderLevelUp(ctx: CanvasRenderingContext2D, state: GameState, theme: typeof LEVEL_THEMES[0]) {
  const alpha = Math.min(1, state.levelUpTimer / 60)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 8
  ctx.textAlign = 'center'

  ctx.fillStyle = theme.accent
  ctx.font = 'bold 48px Arial'
  ctx.fillText(`LEVEL ${state.level}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20)

  ctx.fillStyle = '#ffffff'
  ctx.font = '24px Arial'
  ctx.fillText(theme.name, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)

  if (state.level % 5 === 0) {
    ctx.fillStyle = '#ff5a6a'
    ctx.font = 'bold 18px Arial'
    ctx.fillText('❤️ +1 LIFE!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 55)
  }

  ctx.restore()
}

function renderWaveComplete(ctx: CanvasRenderingContext2D, state: GameState, theme: typeof LEVEL_THEMES[0]) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 8
  ctx.textAlign = 'center'

  ctx.fillStyle = theme.accent
  ctx.font = 'bold 36px Arial'
  ctx.fillText(`WAVE ${state.wave} COMPLETE!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20)

  if (state.noHitWave) {
    ctx.fillStyle = '#4cf0ff'
    ctx.font = 'bold 20px Arial'
    ctx.fillText('PERFECT! +200', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
  }

  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.font = '16px Arial'
  ctx.fillText('Next wave incoming...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50)
  ctx.restore()
}

function renderWaveStart(ctx: CanvasRenderingContext2D, state: GameState, theme: typeof LEVEL_THEMES[0]) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 8
  ctx.textAlign = 'center'

  ctx.fillStyle = theme.accent
  ctx.font = 'bold 42px Arial'
  ctx.fillText(`WAVE ${state.wave}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)

  if (state.wave % 10 === 0) {
    ctx.fillStyle = '#ff5a6a'
    ctx.font = 'bold 24px Arial'
    ctx.fillText('⚔️ BOSS WAVE ⚔️', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
  }
  ctx.restore()
}

function renderGetReady(ctx: CanvasRenderingContext2D, theme: typeof LEVEL_THEMES[0]) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 8
  ctx.textAlign = 'center'

  ctx.fillStyle = theme.accent
  ctx.font = 'bold 36px Arial'
  ctx.fillText('GET READY!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)

  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '16px Arial'
  ctx.fillText('Enemies approach from the right', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 35)
  ctx.fillText('Slash projectiles to destroy them!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 55)
  ctx.restore()
}
