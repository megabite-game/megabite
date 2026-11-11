import type { ClientModule, ClientSurface } from 'claude-code'

import type { GameProps, RareEntry, SizeGrade } from '../types'
import { formatLength, formatWeight, GRADE_COLOR, GRADE_LABEL, RARITY_COLOR } from './fish'
import { HOOK_FLASH, HOOKED_LINE, letOut, reelIn, reelTick, ZONE_HIGH, ZONE_LOW } from './reel'
import type { Line } from './reel'

type View = 'fish' | 'rare' | 'heavy'
const VIEWS: readonly View[] = ['fish', 'rare', 'heavy']

type Phase = 'idle' | 'charging' | 'flying' | 'waiting' | 'bite' | 'reeling' | 'landed' | 'lost'

// The game's state; the line's fields (tension, progress, wear, …) are reel.ts's `Line`.
type State = Line & {
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

type Segment = { text: string; color?: string; bg?: string; bold?: boolean }

const TICK_MS = 100
const DOCK = 7
const FLIGHT_TICKS = 8
const BITE_WINDOW = 14
// Water gets darker with depth; one background per row.
const SURFACE_BG = '#1e88e5'
const DEPTH_BG = ['#1565c0', '#0d47a1']
const DOCK_COLOR = '#a1887f'
const SCENE_ROWS = 5
const SURFACE = 2
const TIP = { r: 0, c: 6 }

// Props reach the module on each call; the timer and key listener were set up once, on the first call,
// so they read the newest props from here instead of the stale ones they closed over. Keyed by surface.
const latest = new WeakMap<object, GameProps>()
// The Claude-done count each game last saw, and the tick its flash ends.
const doneSeen = new WeakMap<object, { count: number; flashUntil: number }>()

const initial = (): State => ({
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

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

const castFeet = (distance: number): number => Math.round(10 + distance * 60)

// Space reels in (more tension); left arrow or right-click lets line out (less tension).
const giveLine = (surface: ClientSurface<State>): void => {
  const s = surface.state
  if (!s || s.phase !== 'reeling') return
  surface.setState({ ...s, ...letOut(s) })
}

// Tab: water, rarest, heaviest, back to water. Never mid-fight; before a bite it reels the line back in.
const nextView = (surface: ClientSurface<State>): void => {
  const s = surface.state
  if (!s || s.phase === 'bite' || s.phase === 'reeling') return
  const view = VIEWS[(VIEWS.indexOf(s.view) + 1) % VIEWS.length] ?? 'fish'
  if (s.view === 'fish') surface.setState({ ...initial(), tick: s.tick, view })
  else surface.setState({ ...s, view })
}

const press = (surface: ClientSurface<State>): void => {
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

const tick = (surface: ClientSurface<State>): void => {
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

const isAction = (key: string): boolean => key === ' ' || key === 'space' || key === 'return' || key === 'enter'

const tensionColor = (tension: number): string =>
  tension < ZONE_LOW ? '#ffb300' : tension < ZONE_HIGH ? '#43a047' : '#e53935'

// Sprites by how hard the fish fights: [facing the dock, fleeing].
const fishSprite = (difficulty: number): [string, string] =>
  difficulty < 0.3
    ? ['<><', '><>']
    : difficulty < 0.6
      ? ['<°)><', '><(°>']
      : difficulty < 0.85
        ? ['<°)))><', '><(((°>']
        : ['<°)))))><', '><(((((°>']

const landingColumn = (distance: number, width: number): number => DOCK + 3 + Math.round(distance * (width - DOCK - 5))

// Merge one row of cells into runs of the same style.
const runs = (cells: Segment[]): Segment[] => {
  const out: Segment[] = []
  for (const cell of cells) {
    const prev = out[out.length - 1]
    if (prev && prev.color === cell.color && prev.bg === cell.bg && prev.bold === cell.bold) prev.text += cell.text
    else out.push({ ...cell })
  }
  return out
}

// Five rows: two of air (angler, rod, flight), the surface with the dock, two of water.
const scene = (s: State, props: GameProps, width: number): Segment[][] => {
  const bgFor = (r: number, c: number): string | undefined => {
    if (r < SURFACE) return undefined
    if (r === SURFACE) return c < DOCK ? undefined : SURFACE_BG
    return DEPTH_BG[Math.min(DEPTH_BG.length - 1, r - SURFACE - 1)]
  }
  const rows: Segment[][] = Array.from({ length: SCENE_ROWS }, (_, r) =>
    Array.from({ length: width }, (_, c) => ({ text: ' ', bg: bgFor(r, c) }) as Segment),
  )
  const put = (r: number, c: number, text: string, color?: string, bold?: boolean): void => {
    const row = rows[r]
    if (!row) return
    for (let i = 0; i < text.length; i++) {
      if (c + i >= 0 && c + i < width) row[c + i] = { text: text.charAt(i), color, bold, bg: bgFor(r, c + i) }
    }
  }
  // A line between two cells, ends excluded; `gap` 2 draws every other cell so a long line stays light.
  const line = (r0: number, c0: number, r1: number, c1: number, ch: string, color: string, gap = 2): void => {
    const steps = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0))
    for (let i = 1; i < steps; i += gap)
      put(Math.round(r0 + ((r1 - r0) * i) / steps), Math.round(c0 + ((c1 - c0) * i) / steps), ch, color)
  }
  const t = s.tick
  const bottom = SCENE_ROWS - 1

  // Sky: just the sun.
  put(0, width - 2, '☼', '#ffd54f', true)

  // Dock, surface shimmer and bubbles.
  put(SURFACE, 0, '▄'.repeat(DOCK), DOCK_COLOR)
  for (let r = SURFACE + 1; r < SCENE_ROWS; r++) put(r, DOCK - 2, '║', DOCK_COLOR)
  for (let c = DOCK; c < width; c++) {
    const phase = (c + Math.floor(t / 3)) % 11
    put(SURFACE, c, phase === 0 ? '⌒' : '≈', phase === 0 ? '#e3f2fd' : '#90caf9')
  }
  for (let c = DOCK + 4; c < width; c += 15) {
    const life = (Math.floor(t / 4) + c) % 8
    if (life < 2) put(bottom - life, c, life ? '°' : 'o', '#bbdefb')
  }

  // Background fish, hidden once one is on the line.
  const isFighting = s.phase === 'bite' || s.phase === 'reeling'
  if (!isFighting) {
    const span = Math.max(1, width - DOCK - 4)
    const d = Math.floor(t / 5) % (span * 2)
    put(bottom, DOCK + (d < span ? d : span * 2 - d), d < span ? '><>' : '<><', '#81d4fa')
  }

  // Angler; the rod winds back while charging and bends under tension.
  put(0, 2, 'O', '#ffe0b2', true)
  put(1, 1, '/|\\', '#ffe0b2')
  put(1, 2, '|', '#ef5350')
  const rodColor = s.phase === 'reeling' ? tensionColor(s.tension) : '#bcaaa4'
  let tip = TIP
  if (s.phase === 'charging' && s.power >= 0.67) {
    put(1, 4, '\\', rodColor)
    put(0, 3, '\\', rodColor, true)
    tip = { r: 0, c: 3 }
  } else if (s.phase === 'charging' && s.power >= 0.34) {
    put(1, 4, '|', rodColor)
    put(0, 4, '|', rodColor, true)
    tip = { r: 0, c: 4 }
  } else if (s.phase === 'reeling' && s.tension >= ZONE_HIGH - 15) {
    put(1, 4, '/', rodColor)
    put(0, 5, '‾\\', rodColor, true)
    tip = { r: 1, c: 6 }
  } else {
    put(1, 4, '/', rodColor)
    put(0, 5, '/', rodColor, true)
  }

  const far = landingColumn(s.distance, width)

  if (s.phase === 'charging') put(1, landingColumn(s.power, width), '▼', s.power > 0.8 ? '#ff7043' : '#ffca28', true)

  if (s.phase === 'flying') {
    const at = (f: number): { r: number; c: number } => ({
      r: Math.round(clamp(2 * f - 2.5 * Math.sin(Math.PI * f), 0, SURFACE)),
      c: Math.round(TIP.c + (far - TIP.c) * f),
    })
    const f = (t - s.castAt) / FLIGHT_TICKS
    for (const back of [0.3, 0.15]) {
      if (f - back > 0) {
        const p = at(f - back)
        put(p.r, p.c, '·', '#90a4ae')
      }
    }
    const p = at(f)
    put(p.r, p.c, '•', '#ff7043', true)
  }

  if (s.phase === 'waiting') {
    const sinceLanding = t - s.landAt
    line(TIP.r, TIP.c, SURFACE, far, '.', '#eceff1')
    if (sinceLanding < 4) {
      put(SURFACE, far - sinceLanding - 1, '(', '#e3f2fd', true)
      put(SURFACE, far + sinceLanding + 1, ')', '#e3f2fd', true)
    }
    const isNibbling = s.biteAt - t < 15 && t % 6 < 2
    put(SURFACE, far, isNibbling ? 'o' : '●', '#ff5252', true)
    if (isNibbling) put(SURFACE + 1, far - 1, '·°·', '#bbdefb')
  }

  if (s.phase === 'bite') {
    const isDunked = t % 4 < 2
    line(TIP.r, TIP.c, SURFACE, far, '.', '#eceff1')
    put(0, far, '!', '#ff5252', true)
    if (isDunked) {
      put(SURFACE, far - 2, '(', '#ffffff', true)
      put(SURFACE, far + 2, ')', '#ffffff', true)
      put(SURFACE + 1, far, '●', '#ff5252', true)
    } else {
      put(1, far - 1, '\\|/', '#ffffff', true)
      put(SURFACE, far, '●', '#ff5252', true)
    }
    put(bottom, far - 1, '<><', '#ffffff', true)
  }

  if (s.phase === 'reeling') {
    const d = props.hooked?.difficulty ?? 0.5
    const isRunning = s.runTicks > 0
    const [toDock, fleeing] = fishSprite(d)
    const wiggle = isRunning ? (t % 2 ? 1 : -1) : t % 6 < 3 ? 0 : 1
    const fx = Math.round(far - (far - DOCK - 2) * (s.progress / 100)) + wiggle
    const lineColor = tensionColor(s.tension)
    const lineChar = s.tension >= ZONE_HIGH - 15 ? '━' : s.tension < ZONE_LOW ? ',' : '.'
    line(tip.r, tip.c, SURFACE, fx, lineChar, lineColor, lineChar === '━' ? 1 : 2)
    put(SURFACE, fx, '|', lineColor, true)
    const sprite = isRunning ? fleeing : toDock
    put(
      isRunning ? bottom : SURFACE + 1,
      isRunning ? fx : fx - Math.floor(sprite.length / 2),
      sprite,
      isRunning ? '#ffab91' : '#ffffff',
      true,
    )
    if (isRunning) put(SURFACE, fx - 1, t % 2 ? '*~*' : '~*~', '#ffffff', true)
    if (s.shakeWarn > 0) put(SURFACE - 1, fx, '↯', '#ffeb3b', true)
    if (t - s.hookedAt < HOOK_FLASH) put(1, fx - 1, t % 2 ? '\\|/' : '/|\\', '#ffffff', true)
  }

  return rows.map(runs)
}

const bar = (value: number, width: number, color: string): Segment[] => {
  const filled = Math.round(clamp(value, 0, 1) * width)
  return [
    { text: '█'.repeat(filled), color },
    { text: '░'.repeat(width - filled), color: '#455a64' },
  ]
}

const tensionGauge = (tension: number, width: number): Segment[] => {
  const marker = Math.min(width - 1, Math.floor((clamp(tension, 0, 100) / 100) * width))
  const cells: Segment[] = []
  for (let i = 0; i < width; i++) {
    cells.push(
      i === marker
        ? { text: '◆', color: '#ffffff', bold: true }
        : { text: '━', color: tensionColor((i / width) * 100) },
    )
  }
  return runs(cells)
}

// The fish's way back to the dock: reeled line, the fish, then open water.
const reelTrack = (progress: number, width: number, sprite: string): Segment[] => {
  const room = Math.max(1, width - sprite.length)
  const at = Math.round((1 - progress / 100) * room)
  return [
    { text: '▐', color: DOCK_COLOR },
    { text: '─'.repeat(at), color: '#26c6da' },
    { text: sprite, color: '#ffffff', bold: true },
    { text: '·'.repeat(Math.max(0, room - at)), color: '#455a64' },
  ]
}

const SPACE: Segment = { text: ' ␣ ', color: '#263238', bg: '#cfd8dc', bold: true }
// One to three "!" as the line frays; red and flashing near breaking.
const wearMarks = (wear: number, t: number): Segment[] =>
  wear < 0.2
    ? []
    : wear < 0.5
      ? [{ text: ' !', color: '#ffb300', bold: true }]
      : wear < 0.8
        ? [{ text: ' !!', color: '#ff7043', bold: true }]
        : [{ text: ' !!!', color: t % 4 < 2 ? '#e53935' : '#ff8a80', bold: true }]

// A key cap; lit in a colour when it is the key to press now.
const chip = (label: string, lit?: string): Segment => ({
  text: ` ${label} `,
  color: lit ? '#ffffff' : '#263238',
  bg: lit ?? '#cfd8dc',
  bold: true,
})
const dim = (text: string): Segment => ({ text, color: '#78909c' })

// A coloured tag for a fish that is big for its species; nothing for an ordinary one.
const gradeTag = (grade: SizeGrade | null): Segment[] =>
  grade ? [{ text: `${GRADE_LABEL[grade]} `, color: GRADE_COLOR[grade], bold: true }] : []

type Hud = { line: Segment[]; accent: string }

// One line of icons and bars; the border colour carries the mood.
const hud = (s: State, props: GameProps | undefined, width: number): Hud => {
  const t = s.tick
  const half = Math.max(8, Math.floor((width - 10) / 2))
  switch (s.phase) {
    case 'idle':
      return {
        accent: '#546e7a',
        line: [SPACE, dim(' cast  '), chip('tab'), dim(' records  '), chip('esc'), dim(' close')],
      }
    case 'charging':
      return {
        accent: '#ffb300',
        line: [
          SPACE,
          { text: ' ' },
          ...bar(s.power, half * 2 - 4, s.power > 0.8 ? '#ff7043' : '#ffca28'),
          { text: ` ${castFeet(s.power)}ft`, bold: true },
        ],
      }
    case 'flying':
      return { accent: '#ffb300', line: [dim(`→ ${castFeet(s.distance)}ft`)] }
    case 'waiting': {
      const isClose = s.biteAt - t < 15
      return {
        accent: '#42a5f5',
        line: [isClose ? { text: '…', color: '#ffca28', bold: true } : dim('·'.repeat(1 + (Math.floor(t / 5) % 3)))],
      }
    }
    case 'bite':
      return {
        accent: t % 4 < 2 ? '#ff5252' : '#ffca28',
        line: [
          { text: ' ! ', color: '#ffffff', bg: t % 4 < 2 ? '#d32f2f' : '#f57c00', bold: true },
          { text: ' ' },
          SPACE,
          { text: ' ' },
          ...bar(clamp((s.windowEnd - t) / BITE_WINDOW, 0, 1), half, '#ff5252'),
        ],
      }
    case 'reeling': {
      const d = props?.hooked?.difficulty ?? 0.5
      const isRunning = s.runTicks > 0
      return {
        accent:
          s.shakeWarn > 0
            ? t % 2
              ? '#ffeb3b'
              : '#ff6f00'
            : t - s.hookedAt < HOOK_FLASH
              ? '#66bb6a'
              : isRunning
                ? t % 4 < 2
                  ? '#ff5252'
                  : '#ff8a80'
                : tensionColor(s.tension),
        line: [
          ...(s.shakeWarn > 0 ? [{ text: '↯', color: t % 2 ? '#ffeb3b' : '#ff6f00', bold: true }] : [{ text: ' ' }]),
          chip(
            '←',
            s.shakeWarn > 0
              ? '#f57f17'
              : s.tension >= ZONE_HIGH - 10 || isRunning
                ? t % 4 < 2
                  ? '#e53935'
                  : '#ff8a80'
                : undefined,
          ),
          { text: ' ' },
          ...tensionGauge(s.tension, Math.max(8, half - 6)),
          { text: ' ' },
          chip('␣', s.tension < ZONE_LOW ? '#ffb300' : undefined),
          { text: '  ' },
          ...reelTrack(s.progress, half, fishSprite(d)[0]),
          ...wearMarks(s.wear, t),
        ],
      }
    }
    case 'landed': {
      const caught = props?.last && props.last.id === s.landedId ? props.last : null
      if (!caught) return { accent: '#66bb6a', line: [dim('…')] }
      const color = RARITY_COLOR[caught.rarity]
      return {
        accent: color,
        line: [
          { text: '✓ ', color: '#66bb6a', bold: true },
          ...gradeTag(props?.lastGrade ?? null),
          { text: caught.name, color, bold: true },
          { text: ` ${formatWeight(caught.weightLb)} ${formatLength(caught.lengthIn)}`, bold: true },
        ],
      }
    }
    case 'lost':
      return { accent: '#e53935', line: [{ text: `✗ ${s.note || 'got away'}`, color: '#ef5350', bold: true }] }
  }
}

const RARE_ROWS = 5

// A records view: one row per catch, name coloured by tier, size tag in front, padded to the scene's height.
const listRows = (list: RareEntry[], width: number): Segment[][] => {
  const rows: Segment[][] = list.slice(0, RARE_ROWS).map(one => {
    const color = RARITY_COLOR[one.rarity]
    const stats = ` ${formatWeight(one.weightLb)} ${formatLength(one.lengthIn)}`
    const tagRoom = one.grade ? GRADE_LABEL[one.grade].length + 1 : 0
    const nameRoom = Math.max(6, width - stats.length - tagRoom - 2)
    const name = one.name.length > nameRoom ? `${one.name.slice(0, nameRoom - 1)}…` : one.name.padEnd(nameRoom)
    return [
      { text: '● ', color },
      ...gradeTag(one.grade),
      { text: name, color, bold: true },
      { text: stats, color: '#b0bec5' },
    ]
  })
  if (rows.length === 0) rows.push([dim('Nothing landed yet.')])
  while (rows.length < RARE_ROWS) rows.push([{ text: ' ' }])
  return rows
}

// The records views' footer: every view named, the current one highlighted, Tab to move on.
const VIEW_TAB: Record<View, { label: string; color: string }> = {
  rare: { label: '◆ Rarest', color: '#ba68c8' },
  heavy: { label: '⚖ Heaviest', color: '#ff7043' },
  fish: { label: '~ Water', color: '#42a5f5' },
}
const tabBar = (current: View): Segment[] => [
  ...(['rare', 'heavy', 'fish'] as const).flatMap((view): Segment[] =>
    view === current
      ? [{ text: ` ${VIEW_TAB[view].label} `, color: '#ffffff', bg: VIEW_TAB[view].color, bold: true }, { text: ' ' }]
      : [dim(` ${VIEW_TAB[view].label} `), { text: ' ' }],
  ),
  dim(' tab ↹'),
]

const Game: ClientModule<GameProps, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  latest.set(surface, props)

  if (surface.state === undefined) {
    surface.every(TICK_MS, () => tick(surface))
    surface.onKey(event => {
      if (isAction(event.key)) press(surface)
      else if (event.key === 'left') giveLine(surface)
      else if (event.key === 'q') surface.post({ type: 'close' })
      else if (event.key === 'tab') nextView(surface)
      else if (event.key === 'm') surface.post({ type: 'sound' })
    })
    surface.setState(initial())
    return <Text dimColor>…</Text>
  }

  const s = surface.state
  const width = Math.max(24, Math.min(80, (surface.columns || 44) - 4))
  // A new Claude-done count starts a 3-second flash; the first one seen is just a baseline.
  const seen = doneSeen.get(surface)
  if (!seen) doneSeen.set(surface, { count: props.claudeDoneCount, flashUntil: 0 })
  else if (props.claudeDoneCount !== seen.count)
    doneSeen.set(surface, { count: props.claudeDoneCount, flashUntil: s.tick + 30 })
  const isFlashing = (doneSeen.get(surface)?.flashUntil ?? 0) > s.tick
  const panel: Hud = s.view === 'fish' ? hud(s, props, width) : { accent: VIEW_TAB[s.view].color, line: tabBar(s.view) }

  const row = (line: Segment[]) => (
    <Box flexDirection="row">
      {line.map(seg => (
        <Text color={seg.color} backgroundColor={seg.bg} weight={seg.bold ? 'bold' : undefined}>
          {seg.text}
        </Text>
      ))}
    </Box>
  )

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFlashing ? (s.tick % 4 < 2 ? '#66bb6a' : '#b9f6ca') : panel.accent}
      paddingX={1}
    >
      {(s.view === 'rare'
        ? listRows(props.rare, width)
        : s.view === 'heavy'
          ? listRows(props.heavy, width)
          : scene(s, props, width)
      ).map(row)}
      <Box flexDirection="row" justifyContent="space-between">
        {row(panel.line)}
        {props.isClaudeBusy ? (
          <Text color="#ffca28">◌</Text>
        ) : isFlashing ? (
          <Text color="#ffffff" backgroundColor="#2e7d32" weight="bold">
            {' ✓ Claude done '}
          </Text>
        ) : (
          <Text color="#66bb6a">✓</Text>
        )}
      </Box>
    </Box>
  )
}

export default Game
