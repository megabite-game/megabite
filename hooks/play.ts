import type { ClientSurface } from 'claude-code'

import type { GameMessage, GameProps } from '../types'
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
  // The fish on the line, named by the game at the bite; the hooks module rolls it under this id.
  fishId: string | null
  landedId: string | null
  note: string
}

export const TICK_MS = 100

export const FLIGHT_TICKS = 8
export const BITE_WINDOW = 14
// While nothing happens the scene moves every third tick, so the pane redraws a third as often.
const IDLE_STEP = 3

// Props reach the module on each call; the timer and key listener were set up once, on the first call,
// so they read the newest props from here instead of the stale ones they closed over. Keyed by surface.
export const latest = new WeakMap<object, GameProps>()

// Ticks since the last idle redraw, kept off the state so a skipped tick changes nothing drawn.
const idleTicks = new WeakMap<object, number>()

const newId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

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

// The hooked fish as the props show it, but only once they show this game's fish, never an earlier one.
export const hookedFish = (s: State, props: GameProps | undefined): GameProps['hooked'] =>
  props?.hooked && props.hooked.id === s.fishId ? props.hooked : null

// Posts to the hooks module go through a queue. A surface posts once per frame and a later post in the
// same frame replaces an undelivered one, so each message is posted from the clock, one per tick, until
// the props show it arrived. The hooks module treats a repeat as a no-op. Keyed by surface.
type Pending = { message: GameMessage; tries: number }
const outbox = new WeakMap<object, Pending[]>()
// About five seconds of tries before a message nobody answers is dropped.
const MAX_TRIES = 50

export const send = (surface: object, message: GameMessage): void => {
  const queue = outbox.get(surface) ?? []
  queue.push({ message, tries: 0 })
  outbox.set(surface, queue)
}

// Whether the props show the hooks module acted on a message; a close or a mute is done once posted.
const isDelivered = ({ message, tries }: Pending, props: GameProps | undefined): boolean => {
  switch (message.type) {
    case 'bite':
      return props?.hooked?.id === message.id
    case 'land':
      return props?.last?.id === message.id
    case 'lost':
      return tries > 0 && props?.hooked?.id !== message.id
    case 'close':
    case 'sound':
      return tries > 0
  }
}

// Drop what has arrived, then post the oldest message still waiting.
export const flush = (surface: ClientSurface<State>): void => {
  const queue = outbox.get(surface)
  if (!queue) return
  const props = latest.get(surface)
  while (queue[0] && (isDelivered(queue[0], props) || queue[0].tries >= MAX_TRIES)) queue.shift()
  const head = queue[0]
  if (!head) return
  surface.post(head.message)
  head.tries += 1
}

// Space reels in (more tension); the left arrow lets line out (less tension).
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
      surface.setState({ ...s, ...HOOKED_LINE, phase: 'reeling', hookedAt: s.tick })
      return
    case 'reeling':
      surface.setState({ ...s, ...reelIn(s) })
      return
  }
}

// One tick of the clock: move the game on, then post what is waiting.
export const tick = (surface: ClientSurface<State>): void => {
  step(surface)
  flush(surface)
}

const step = (surface: ClientSurface<State>): void => {
  const s = surface.state
  if (!s) return
  const t = s.tick + 1

  switch (s.phase) {
    case 'idle':
    case 'landed':
    case 'lost': {
      // Waves only: the scene moves IDLE_STEP ticks at once, every IDLE_STEP ticks.
      const waited = (idleTicks.get(surface) ?? 0) + 1
      if (waited < IDLE_STEP) {
        idleTicks.set(surface, waited)
        return
      }
      idleTicks.set(surface, 0)
      surface.setState({ ...s, tick: s.tick + IDLE_STEP })
      return
    }
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
        const fishId = newId()
        send(surface, { type: 'bite', distance: s.distance, id: fishId })
        surface.setState({ ...s, tick: t, phase: 'bite', windowEnd: t + BITE_WINDOW, fishId })
      } else surface.setState({ ...s, tick: t })
      return
    case 'bite':
      if (t > s.windowEnd) {
        if (s.fishId) send(surface, { type: 'lost', id: s.fishId })
        surface.setState({ ...s, tick: t, phase: 'lost', note: 'too slow' })
      } else surface.setState({ ...s, tick: t })
      return
    case 'reeling': {
      const fish = hookedFish(s, latest.get(surface))
      const fighter = { difficulty: fish?.difficulty ?? 0.5, rarity: fish?.rarity ?? 'common' }
      const result = reelTick(s, t - s.hookedAt, fighter, Math.random)
      if (result.kind === 'lost') {
        if (s.fishId) send(surface, { type: 'lost', id: s.fishId })
        surface.setState({ ...s, ...result.patch, tick: t, phase: 'lost', note: result.note })
      } else if (result.kind === 'landed') {
        if (s.fishId) send(surface, { type: 'land', id: s.fishId })
        surface.setState({ ...s, tick: t, phase: 'landed', progress: result.progress, landedId: s.fishId })
      } else {
        surface.setState({ ...s, ...result.line, tick: t })
      }
      return
    }
  }
}

export const isAction = (key: string): boolean => key === ' ' || key === 'space' || key === 'return' || key === 'enter'
