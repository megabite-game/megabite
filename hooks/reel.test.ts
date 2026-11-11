import { expect, test } from 'claude-code/testing'

import { seeded } from './fixtures'
import { HOOKED_LINE, letOut, reelIn, reelTick } from './reel'
import type { Fighter, Line, ReelStep } from './reel'

// What a player does before a tick: reel in, let out, or nothing.
type Player = (line: Line) => 'in' | 'out' | null

// Keeps the line between 50 and 70 and answers every head shake.
const careful: Player = line => (line.shakeWarn > 0 || line.tension > 70 ? 'out' : line.tension < 50 ? 'in' : null)

// Plays one fight to its end.
const playFight = (
  fish: Fighter,
  random: () => number,
  player: Player = careful,
): { step: ReelStep; ticks: number } => {
  let line: Line = HOOKED_LINE
  for (let tick = 1; tick < 10000; tick++) {
    const move = player(line)
    if (move === 'in') line = { ...line, ...reelIn(line) }
    if (move === 'out') line = { ...line, ...letOut(line) }
    const step = reelTick(line, tick, fish, random)
    if (step.kind !== 'fighting') return { step, ticks: tick }
    line = step.line
    expect(line.tension).toBeGreaterThanOrEqual(0)
    expect(line.tension).toBeLessThanOrEqual(120)
    expect(line.progress).toBeGreaterThanOrEqual(0)
    expect(line.progress).toBeLessThanOrEqual(100)
  }
  throw new Error('fight never ended')
}

test('a calm fish kept in the green is landed', async () => {
  // 0.999 never starts a run, a head shake or a fray.
  const { step } = playFight({ difficulty: 0.5, rarity: 'rare' }, () => 0.999)
  expect(step).toEqual({ kind: 'landed', progress: 100 })
})

test('the same seed fights the same fight', async () => {
  const fish: Fighter = { difficulty: 0.8, rarity: 'epic' }
  expect(playFight(fish, seeded(5))).toEqual(playFight(fish, seeded(5)))
})

test('a slack line shakes the fish loose; an overreeled one snaps', async () => {
  const calm = (): number => 0.999
  const idle = playFight({ difficulty: 0.2, rarity: 'common' }, calm, () => null)
  expect(idle.step).toEqual({ kind: 'lost', note: 'shook loose', patch: {} })
  // Tension falls 1.5 a tick from 55 and goes slack below 15 on tick 27; the 21st slack tick loses it.
  expect(idle.ticks).toBe(47)

  const snapped = reelTick({ ...HOOKED_LINE, tension: 104 }, 1, { difficulty: 0.9, rarity: 'common' }, calm)
  expect(snapped).toEqual({ kind: 'lost', note: 'snapped', patch: { tension: 100 } })
})

test('a head shake answered with left arrow is a nudge; missed, it can snap the line', async () => {
  const warned: Line = { ...HOOKED_LINE, shakeWarn: 1 }
  const fish: Fighter = { difficulty: 0.5, rarity: 'legendary' }
  // 0 is the unluckiest roll: a missed shake snaps.
  expect(reelTick(warned, 20, fish, () => 0)).toEqual({ kind: 'lost', note: 'head shake snapped it', patch: {} })
  const answered = reelTick({ ...warned, ...letOut(warned) }, 20, fish, () => 0)
  if (answered.kind !== 'fighting') throw new Error(`expected the fight to go on, got ${answered.kind}`)
  // Let out 12, drift down 1.8, the shake's nudge +5.
  expect(Math.round(answered.line.tension * 100) / 100).toBe(46.2)
  // Letting out never takes tension below zero, and answers a shake only while one is warned.
  expect(letOut({ ...HOOKED_LINE, tension: 5 })).toEqual({ tension: 0, shakeDodged: false })
})

test('seeded fights end every way a fight can', async () => {
  const random = seeded(3)
  const players: Player[] = [
    careful,
    // Never presses: the line goes slack.
    () => null,
    // Reels in every tick: the line snaps or frays.
    () => 'in',
    // Careful, but never answers a head shake.
    line => (line.tension > 70 ? 'out' : line.tension < 50 ? 'in' : null),
  ]
  const ends = new Set<string>()
  for (let i = 0; i < 400; i++) {
    const fish: Fighter = {
      difficulty: random(),
      rarity: (['common', 'rare', 'legendary'] as const)[i % 3] ?? 'common',
    }
    const { step } = playFight(fish, random, players[i % players.length])
    ends.add(step.kind === 'lost' ? step.note : step.kind)
  }
  expect([...ends].sort()).toEqual(['frayed line snapped', 'head shake snapped it', 'landed', 'shook loose', 'snapped'])
})
