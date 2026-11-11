import { expect, test } from 'claude-code/testing'

import type { GameProps } from '../types'
import { footer, lineWidth, listRows } from './draw'
import { initial } from './play'
import type { State } from './play'

const props: GameProps = {
  hooked: { id: 'f1', difficulty: 1, rarity: 'legendary' },
  last: {
    id: 'f1',
    species: 'mekong-giant-catfish',
    name: 'Mekong Giant Catfish',
    rarity: 'legendary',
    lengthIn: 105.2,
    weightLb: 640.25,
    caughtAt: '2026-11-11T00:00:00.000Z',
  },
  lastGrade: 'record',
  isClaudeBusy: false,
  claudeDoneCount: 0,
  rare: [],
  heavy: [],
}

test('the bottom row never runs past the pane, flashing or not', async () => {
  const base: State = { ...initial(), tick: 3, fishId: 'f1', landedId: 'f1' }
  const states: State[] = [
    base,
    { ...base, phase: 'charging', power: 0.9 },
    { ...base, phase: 'flying', distance: 1 },
    { ...base, phase: 'waiting', biteAt: 5 },
    { ...base, phase: 'bite', windowEnd: 10 },
    { ...base, phase: 'reeling', hookedAt: -100, wear: 0.9, shakeWarn: 1, runTicks: 2 },
    { ...base, phase: 'landed' },
    { ...base, phase: 'lost', note: 'head shake snapped it' },
    { ...base, view: 'rare' },
    { ...base, view: 'heavy' },
  ]
  for (const width of [20, 24, 44, 76]) {
    for (const s of states) {
      for (const isFlashing of [false, true]) {
        const { line, badge } = footer(s, props, width, isFlashing)
        expect(lineWidth(line) + 1 + lineWidth([badge])).toBeLessThanOrEqual(width)
      }
    }
  }
})

test('the flash says "Claude done" where it fits, and keeps the landed weight on screen', async () => {
  const landed: State = { ...initial(), phase: 'landed', landedId: 'f1' }
  expect(footer(initial(), props, 44, true).badge.text).toBe(' ✓ Claude done ')
  expect(footer({ ...initial(), phase: 'reeling', fishId: 'f1' }, props, 44, true).badge.text).toBe(' ✓ ')
  expect(JSON.stringify(footer(landed, props, 44, true).line)).toContain('640.3 lb')
})

test('a narrow pane keeps the cast distance and the reel track', async () => {
  const charging: State = { ...initial(), phase: 'charging', power: 0.5 }
  const reeling: State = { ...initial(), phase: 'reeling', fishId: 'f1', hookedAt: -100, tension: 60, progress: 40 }
  for (const width of [20, 24, 30]) {
    expect(JSON.stringify(footer(charging, props, width, false).line)).toContain('40ft')
    const line = footer(reeling, props, width, false).line
    expect(JSON.stringify(line)).toContain('▐')
    expect(JSON.stringify(line)).toContain('<')
    expect(JSON.stringify(line)).not.toContain('…')
  }
})

test('records rows never run past the pane, dropping the length before the name', async () => {
  const entry = {
    name: 'Mekong Giant Catfish',
    rarity: 'legendary',
    weightLb: 699.99,
    lengthIn: 106,
    count: 3,
  } as const
  for (const grade of ['record', 'trophy', 'big', null] as const) {
    for (let width = 20; width <= 80; width++) {
      for (const row of listRows([{ ...entry, grade }], width)) expect(lineWidth(row)).toBeLessThanOrEqual(width)
    }
  }
  const wide = JSON.stringify(listRows([{ ...entry, grade: 'record' }], 44))
  expect(wide).toContain('106.0 in')
  const narrow = JSON.stringify(listRows([{ ...entry, grade: 'record' }], 24))
  expect(narrow).toContain('700.0 lb')
  expect(narrow).not.toContain('106.0 in')
})
