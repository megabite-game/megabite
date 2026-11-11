import type { Rarity } from '../types'
import type { Random } from './fish'

// Reeling a hooked fish in: the line's state and one tick of the fight, with no drawing and no I/O.
// The game passes Math.random; tests pass a seeded one.

// The green band of the tension gauge.
export const ZONE_LOW = 35
export const ZONE_HIGH = 80
// Ticks after the hook is set before the fish can run or head-shake.
export const HOOK_FLASH = 8
// Ticks of slack line before the fish shakes loose.
const SLACK_LIMIT = 20
// Ticks of warning before a head shake lands.
const SHAKE_WARNING = 5

// Rarer fish head-shake more often (chance per tick), and a missed shake is likelier to snap the line.
const SHAKE_CHANCE: Record<Rarity, number> = {
  common: 0.001,
  uncommon: 0.004,
  rare: 0.008,
  epic: 0.012,
  legendary: 0.015,
}
const SHAKE_SNAP: Record<Rarity, number> = { common: 0.2, uncommon: 0.3, rare: 0.4, epic: 0.5, legendary: 0.6 }

export type Line = {
  tension: number
  progress: number
  slackTicks: number
  // Ticks left in the fish's current run; while it runs the line pays out.
  runTicks: number
  // Calm ticks left before the fish can run again.
  runCooldown: number
  // Line wear, 0 to 1: builds while the tension is in the red, raising the odds of a snap there.
  wear: number
  // Head shake: ticks of warning left (0 when none), whether ← answered it, and calm ticks before the next.
  shakeWarn: number
  shakeDodged: boolean
  shakeCooldown: number
}

// What the fight needs to know about the fish on the line.
export type Fighter = { difficulty: number; rarity: Rarity }

export type ReelStep =
  | { kind: 'fighting'; line: Line }
  | { kind: 'landed'; progress: number }
  // `patch` holds the line fields the loss leaves changed (a snap pins tension at 100, a fray keeps its wear).
  | { kind: 'lost'; note: string; patch: Partial<Line> }

// The line the moment the hook is set.
export const HOOKED_LINE: Line = {
  tension: 55,
  progress: 0,
  slackTicks: 0,
  runTicks: 0,
  runCooldown: 0,
  wear: 0,
  shakeWarn: 0,
  shakeDodged: false,
  shakeCooldown: 0,
}

// Space: reel in (more tension).
export const reelIn = (line: Line): Pick<Line, 'tension'> => ({ tension: line.tension + 8 })

// ←: let line out (less tension); during a head-shake warning it also answers the shake.
export const letOut = (line: Line): Pick<Line, 'tension' | 'shakeDodged'> => ({
  tension: Math.max(0, line.tension - 12),
  shakeDodged: line.shakeWarn > 0 || line.shakeDodged,
})

// One tick of the fight. `sinceHook` is ticks since the hook was set.
export const reelTick = (line: Line, sinceHook: number, fish: Fighter, random: Random): ReelStep => {
  const d = fish.difficulty
  let runTicks = line.runTicks
  let runCooldown = line.runCooldown
  let tension = line.tension
  if (runTicks > 0) {
    tension += 1.8 + d * 2.2
    runTicks -= 1
    if (runTicks === 0) runCooldown = 14
  } else {
    tension -= 1.3 + d * 1.0
    // The fish tires as it nears the dock, so runs get rarer.
    const runChance = (0.025 + d * 0.05) * (1 - line.progress / 150)
    if (runCooldown > 0) runCooldown -= 1
    else if (sinceHook > HOOK_FLASH && random() < runChance) runTicks = 5 + Math.floor(d * 8)
  }
  // Head shake: a short warning, then a jolt. Answered with ←, it is a nudge; missed, it may snap the line outright.
  let shakeWarn = line.shakeWarn
  let shakeDodged = line.shakeDodged
  let shakeCooldown = Math.max(0, line.shakeCooldown - 1)
  let isShakeSnap = false
  if (shakeWarn > 0) {
    shakeWarn -= 1
    if (shakeWarn === 0) {
      if (shakeDodged) tension += 5
      else if (random() < SHAKE_SNAP[fish.rarity]) isShakeSnap = true
      else tension += 30
      shakeDodged = false
      shakeCooldown = 25
    }
  } else if (shakeCooldown === 0 && runTicks === 0 && sinceHook > HOOK_FLASH && random() < SHAKE_CHANCE[fish.rarity]) {
    shakeWarn = SHAKE_WARNING
    shakeDodged = false
  }
  const isRunning = runTicks > 0
  const inZone = tension >= ZONE_LOW && tension <= ZONE_HIGH
  // A run holds the fish where it is if the line stays in the green; only a bad line loses ground.
  const gain = isRunning ? (inZone ? 0 : -0.4) : inZone ? 2.2 - d * 1.5 : -0.2
  const progress = Math.min(100, Math.max(0, line.progress + gain))
  const slackTicks = tension < ZONE_LOW - 20 ? line.slackTicks + 1 : 0
  const isStrained = tension > ZONE_HIGH
  const wear = isStrained ? Math.min(1, line.wear + 0.015 + d * 0.02) : Math.max(0, line.wear - 0.002)

  if (isShakeSnap) return { kind: 'lost', note: 'head shake snapped it', patch: {} }
  if (isStrained && random() < wear * 0.06) return { kind: 'lost', note: 'frayed line snapped', patch: { wear } }
  if (tension > 100) return { kind: 'lost', note: 'snapped', patch: { tension: 100 } }
  if (slackTicks > SLACK_LIMIT) return { kind: 'lost', note: 'shook loose', patch: {} }
  if (progress >= 100) return { kind: 'landed', progress }
  return {
    kind: 'fighting',
    line: {
      tension: Math.min(120, Math.max(0, tension)),
      progress,
      slackTicks,
      runTicks,
      runCooldown,
      wear,
      shakeWarn,
      shakeDodged,
      shakeCooldown,
    },
  }
}
