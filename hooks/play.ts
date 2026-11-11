import type { ClientSurface } from 'claude-code'

import type { GameProps } from '../types'
import { HOOKED_LINE, letOut, reelIn, reelTick } from './reel'
import type { Line } from './reel'

// The game's state and what keys and the clock do to it; drawing it is draw.ts's job.

export type View = 'fish' | 'rare' | 'heavy'
const VIEWS: readonly View[] = ['fish', 'rare', 'heavy']

type Phase = 'idle' | 'charging' | 'flying' | 'waiting' | 'bite' | 'reeling' | 'landed' | 'lost'

// The game's state; the line's fields (tension, progress, wear, …) are reel.ts's `Line`.
export type State = Line & {
  phase: Phase
  // Tab cycles the water and two record lists; never mid-fight.
  view: View
  tick: number
  power: number
  powerDir: 1 | -1
  distance: number
  castAt: number
  landAt: number
  biteAt: number
  windowEnd: number
  hookedAt: number
  // The hooked fish's id once the hooks module has rolled it.
  fishId: string | null
  landedId: string | null
  note: string
}

export const TICK_MS = 100

export const FLIGHT_TICKS = 8
export const BITE_WINDOW = 14

// Props reach the module on each call; the timer and key listener were set up once, on the first call,
// so they read the newest props from here instead of the stale ones they closed over. Keyed by surface.
export const latest = new WeakMap<object, GameProps>()

export const initial = (): State => ({
  phase: 'idle',
  view: 'fish',
  tick: 0,
  power: 0,
  powerDir: 1,
  distance: 0,
  castAt: 0,
  landAt: 0,
  biteAt: 0,
  windowEnd: 0,
  hookedAt: 0,
  tension: 50,
  progress: 0,
  slackTicks: 0,
  runTicks: 0,
  runCooldown: 0,
  wear: 0,
  shakeWarn: 0,
  shakeDodged: false,
  shakeCooldown: 0,
  fishId: null,
  landedId: null,
  note: '',
})

// Space reels in (more tension); left arrow or right-click lets line out (less tension).
export const giveLine = (surface: ClientSurface<State>): void => {
  const s = surface.state
  if (!s || s.phase !== 'reeling') return
  surface.setState({ ...s, ...letOut(s) })
}

// Tab: water, rarest, heaviest, back to water. Never mid-fight; before a bite it reels the line back in.
export const nextView = (surface: ClientSurface<State>): void => {
  const s = surface.state
  if (!s || s.phase === 'bite' || s.phase === 'reeling') return
  const view = VIEWS[(VIEWS.indexOf(s.view) + 1) % VIEWS.length] ?? 'fish'
  if (s.view === 'fish') surface.setState({ ...initial(), tick: s.tick, view })
  else surface.setState({ ...s, view })
}

export const press = (surface: ClientSurface<State>): void => {
  const s = surface.state
  if (!s) return
  if (s.view !== 'fish') {
    surface.setState({ ...s, view: 'fish' })
    return
  }
  const props = latest.get(surface)

  switch (s.phase) {
    case 'idle':
    case 'landed':
    case 'lost':
      surface.setState({ ...initial(), tick: s.tick, phase: 'charging' })
      return
    case 'charging':
      surface.setState({ ...s, phase: 'flying', distance: s.power, castAt: s.tick })
      return
    case 'flying':
      return
    case 'waiting':
      surface.setState({ ...s, phase: 'lost', note: 'too early' })
      return
    case 'bite':
      surface.setState({
        ...s,
        ...HOOKED_LINE,
        phase: 'reeling',
        hookedAt: s.tick,
        fishId: props?.hooked?.id ?? s.fishId,
      })
      return
    case 'reeling':
      surface.setState({ ...s, ...reelIn(s) })
      return
  }
}

export const tick = (surface: ClientSurface<State>): void => {
  const s = surface.state
  if (!s) return
  const props = latest.get(surface)
  const t = s.tick + 1
  const fishId = s.fishId ?? props?.hooked?.id ?? null

  switch (s.phase) {
    case 'idle':
    case 'landed':
    case 'lost':
      // Waves only; a slower redraw while nothing is happening. On skipped ticks the count is bumped in place,
      // without setState, so the pane does not redraw.
      if (t % 3 === 0) surface.setState({ ...s, tick: t })
      else s.tick = t
      return
    case 'charging': {
      let power = s.power + s.powerDir * 0.05
      let powerDir = s.powerDir
      if (power >= 1) {
        power = 1
        powerDir = -1
      }
      if (power <= 0) {
        power = 0
        powerDir = 1
      }
      surface.setState({ ...s, tick: t, power, powerDir })
      return
    }
    case 'flying':
      if (t - s.castAt >= FLIGHT_TICKS) {
        surface.setState({
          ...s,
          tick: t,
          phase: 'waiting',
          landAt: t,
          biteAt: t + 20 + Math.floor(Math.random() * 60),
        })
      } else surface.setState({ ...s, tick: t })
      return
    case 'waiting':
      if (t >= s.biteAt) {
        surface.post({ type: 'bite', distance: s.distance })
        surface.setState({ ...s, tick: t, phase: 'bite', windowEnd: t + BITE_WINDOW, fishId: null })
      } else surface.setState({ ...s, tick: t })
      return
    case 'bite':
      if (t > s.windowEnd) {
        if (fishId) surface.post({ type: 'lost', id: fishId })
        surface.setState({ ...s, tick: t, phase: 'lost', note: 'too slow' })
      } else surface.setState({ ...s, tick: t, fishId })
      return
    case 'reeling': {
      const fighter = { difficulty: props?.hooked?.difficulty ?? 0.5, rarity: props?.hooked?.rarity ?? 'common' }
      const step = reelTick(s, t - s.hookedAt, fighter, Math.random)
      if (step.kind === 'lost') {
        if (fishId) surface.post({ type: 'lost', id: fishId })
        surface.setState({ ...s, ...step.patch, tick: t, phase: 'lost', note: step.note })
      } else if (step.kind === 'landed') {
        if (fishId) surface.post({ type: 'land', id: fishId })
        surface.setState({ ...s, tick: t, phase: 'landed', progress: step.progress, landedId: fishId })
      } else {
        surface.setState({ ...s, ...step.line, tick: t, fishId })
      }
      return
    }
  }
}

export const isAction = (key: string): boolean => key === ' ' || key === 'space' || key === 'return' || key === 'enter'
