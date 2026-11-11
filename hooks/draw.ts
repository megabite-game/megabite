import type { GameProps, RareEntry, SizeGrade } from '../types'
import { formatLength, formatWeight, GRADE_COLOR, GRADE_LABEL, RARITY_COLOR } from './fish'
import { BITE_WINDOW, FLIGHT_TICKS, hookedFish } from './play'
import type { State, View } from './play'
import { HOOK_FLASH, ZONE_HIGH, ZONE_LOW } from './reel'

// Drawing the game as rows of styled text: the scene, the one-line HUD and the records views. No state changes here.

export type Segment = { text: string; color?: string; bg?: string; bold?: boolean }

// Cells a row of segments takes.
export const lineWidth = (line: Segment[]): number => line.reduce((sum, seg) => sum + [...seg.text].length, 0)

// Cut a row to `room` cells, ending in … where it was cut.
export const fit = (line: Segment[], room: number): Segment[] => {
  if (lineWidth(line) <= room) return line
  const out: Segment[] = []
  let left = Math.max(0, room - 1)
  for (const seg of line) {
    const chars = [...seg.text]
    if (chars.length > left) {
      if (left > 0) out.push({ ...seg, text: chars.slice(0, left).join('') })
      break
    }
    out.push(seg)
    left -= chars.length
  }
  return [...out, { text: '…', color: '#78909c' }]
}

// Whole groups of segments, in order, as many as fit in `room`.
const groupsThatFit = (groups: Segment[][], room: number): Segment[] => {
  const out: Segment[] = []
  for (const group of groups) {
    if (lineWidth(out) + lineWidth(group) > room) break
    out.push(...group)
  }
  return out
}

const DOCK = 7

// Water gets darker with depth; one background per row.
const SURFACE_BG = '#1e88e5'
const DEPTH_BG = ['#1565c0', '#0d47a1']
const DOCK_COLOR = '#a1887f'
const SCENE_ROWS = 5
const SURFACE = 2
const TIP = { r: 0, c: 6 }

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

const castFeet = (distance: number): number => Math.round(10 + distance * 60)

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
export const scene = (s: State, props: GameProps, width: number): Segment[][] => {
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
    const d = hookedFish(s, props)?.difficulty ?? 0.5
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

// The fish's way back to the dock: reeled line, the fish, then open water; `water` cells besides the fish.
const reelTrack = (progress: number, water: number, sprite: string): Segment[] => {
  const at = Math.round((1 - progress / 100) * water)
  return [
    { text: '▐', color: DOCK_COLOR },
    { text: '─'.repeat(at), color: '#26c6da' },
    { text: sprite, color: '#ffffff', bold: true },
    { text: '·'.repeat(Math.max(0, water - at)), color: '#455a64' },
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

export type Hud = { line: Segment[]; accent: string }

// One line of icons and bars, at most `width` cells; the border colour carries the mood.
export const hud = (s: State, props: GameProps | undefined, width: number): Hud => {
  const t = s.tick
  const half = Math.max(8, Math.floor((width - 10) / 2))
  switch (s.phase) {
    case 'idle':
      return {
        accent: '#546e7a',
        line: groupsThatFit(
          [
            [SPACE, dim(' cast')],
            [dim('  '), chip('tab'), dim(' records')],
            [dim('  '), chip('esc'), dim(' close')],
          ],
          width,
        ),
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
      const d = hookedFish(s, props)?.difficulty ?? 0.5
      const isRunning = s.runTicks > 0
      const sprite = fishSprite(d)[0]
      // Fixed cells: ↯, the ← key, three gaps, the ␣ key, the dock, the fish, and room for the wear marks.
      const free = Math.max(12, width - (16 + sprite.length))
      const gauge = Math.max(6, Math.floor(free / 2))
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
          ...tensionGauge(s.tension, gauge),
          { text: ' ' },
          chip('␣', s.tension < ZONE_LOW ? '#ffb300' : undefined),
          { text: '  ' },
          ...reelTrack(s.progress, Math.max(4, free - gauge), sprite),
          ...wearMarks(s.wear, t),
        ],
      }
    }
    case 'landed': {
      const caught = props?.last && props.last.id === s.landedId ? props.last : null
      if (!caught) return { accent: '#66bb6a', line: [dim('…')] }
      const color = RARITY_COLOR[caught.rarity]
      const tag = gradeTag(props?.lastGrade ?? null)
      const stats = ` ${formatWeight(caught.weightLb)} ${formatLength(caught.lengthIn)}`
      // A long name gives way so the weight and length stay on the line.
      const nameRoom = Math.max(4, width - 2 - lineWidth(tag) - stats.length)
      const name = caught.name.length > nameRoom ? `${caught.name.slice(0, nameRoom - 1)}…` : caught.name
      return {
        accent: color,
        line: [
          { text: '✓ ', color: '#66bb6a', bold: true },
          ...tag,
          { text: name, color, bold: true },
          { text: stats, bold: true },
        ],
      }
    }
    case 'lost':
      return { accent: '#e53935', line: [{ text: `✗ ${s.note || 'got away'}`, color: '#ef5350', bold: true }] }
  }
}

const RARE_ROWS = 5

// The fewest cells of a name a records row keeps before it drops the length.
const MIN_NAME = 6

// A records view: one row per catch, name coloured by tier, size tag in front, padded to the scene's height.
// In a narrow pane the length gives way first, then the name; no row runs past `width`.
export const listRows = (list: RareEntry[], width: number): Segment[][] => {
  const rows: Segment[][] = list.slice(0, RARE_ROWS).map(one => {
    const color = RARITY_COLOR[one.rarity]
    const tagRoom = one.grade ? GRADE_LABEL[one.grade].length + 1 : 0
    const full = ` ${formatWeight(one.weightLb)} ${formatLength(one.lengthIn)}`
    const stats = width - full.length - tagRoom - 2 >= MIN_NAME ? full : ` ${formatWeight(one.weightLb)}`
    const nameRoom = Math.max(2, width - stats.length - tagRoom - 2)
    const name = one.name.length > nameRoom ? `${one.name.slice(0, nameRoom - 1)}…` : one.name.padEnd(nameRoom)
    return fit(
      [
        { text: '● ', color },
        ...gradeTag(one.grade),
        { text: name, color, bold: true },
        { text: stats, color: '#b0bec5' },
      ],
      width,
    )
  })
  if (rows.length === 0) rows.push([dim('Nothing landed yet.')])
  while (rows.length < RARE_ROWS) rows.push([{ text: ' ' }])
  return rows
}

// The records views' footer: every view named, the current one highlighted, Tab to move on.
// Where that does not fit in `room`, only the current view is named.
export const VIEW_TAB: Record<View, { label: string; color: string }> = {
  rare: { label: '◆ Rarest', color: '#ba68c8' },
  heavy: { label: '⚖ Heaviest', color: '#ff7043' },
  fish: { label: '~ Water', color: '#42a5f5' },
}
export const tabBar = (current: View, room: number): Segment[] => {
  const lit = (view: View): Segment => ({
    text: ` ${VIEW_TAB[view].label} `,
    color: '#ffffff',
    bg: VIEW_TAB[view].color,
    bold: true,
  })
  const full = [
    ...(['rare', 'heavy', 'fish'] as const).flatMap((view): Segment[] =>
      view === current ? [lit(view), { text: ' ' }] : [dim(` ${VIEW_TAB[view].label} `), { text: ' ' }],
    ),
    dim(' tab ↹'),
  ]
  return lineWidth(full) <= room ? full : [lit(current), dim('  tab ↹')]
}

const BUSY: Segment = { text: '◌', color: '#ffca28' }
const READY: Segment = { text: '✓', color: '#66bb6a' }
const DONE: Segment = { text: ' ✓ Claude done ', color: '#ffffff', bg: '#2e7d32', bold: true }
// The short flash, mid-fight or in a narrow pane, where the HUD needs the room.
const DONE_SHORT: Segment = { ...DONE, text: ' ✓ ' }

export type Footer = { accent: string; line: Segment[]; badge: Segment }

// The bottom row: the HUD (or the records tabs) on the left and Claude's state on the right, one gap
// between, never wider than `width`.
export const footer = (s: State, props: GameProps | undefined, width: number, isFlashing: boolean): Footer => {
  const isFighting = s.phase === 'bite' || s.phase === 'reeling'
  const badge = props?.isClaudeBusy ? BUSY : !isFlashing ? READY : isFighting || width < 40 ? DONE_SHORT : DONE
  const room = width - lineWidth([badge]) - 1
  const panel: Hud =
    s.view === 'fish' ? hud(s, props, room) : { accent: VIEW_TAB[s.view].color, line: tabBar(s.view, room) }
  return { accent: panel.accent, line: fit(panel.line, room), badge }
}
