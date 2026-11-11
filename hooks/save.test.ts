import { expect, test } from 'claude-code/testing'

import type { Hooked } from '../types'
import { gill, trout, tuna } from './fixtures'
import { formatHelp, formatRare, formatTop } from './format'
import { catchNews, EMPTY_SAVE, gradeIntro, isNewerSave, landFish, rarest, recordCatch, toSave } from './save'

test('the record is the heaviest catch', async () => {
  const base = { rarity: 'common', caughtAt: '2026-11-11T00:00:00.000Z' } as const
  const one = recordCatch(EMPTY_SAVE, {
    ...base,
    id: 'a',
    species: 'largemouth-bass',
    name: 'Largemouth Bass',
    lengthIn: 14,
    weightLb: 1.5,
  })
  const two = recordCatch(one, {
    ...base,
    id: 'b',
    species: 'common-carp',
    name: 'Common Carp',
    lengthIn: 20,
    weightLb: 5,
  })
  const three = recordCatch(two, {
    ...base,
    id: 'c',
    species: 'bluegill',
    name: 'Bluegill',
    lengthIn: 7,
    weightLb: 0.3,
  })
  expect(three.biggest?.id).toBe('b')
  expect(three.totalCaught).toBe(3)
  expect(three.species['largemouth-bass']?.count).toBe(1)
  expect(three.recent[0]?.id).toBe('c')
})

test('a small legendary is the rarest while the tuna stays the heaviest', async () => {
  const save = recordCatch(recordCatch(EMPTY_SAVE, tuna), trout)
  expect(save.biggest?.name).toBe('Bluefin Tuna')
  expect(rarest(save)).toEqual({ name: 'Golden Trout', rarity: 'legendary' })
})

test('catch news: record first, then new species, then personal best, else nothing', async () => {
  const withTuna = recordCatch(EMPTY_SAVE, tuna)
  expect(catchNews(EMPTY_SAVE, gill)).toMatch(/MegaBite record/)
  expect(catchNews(withTuna, gill)).toBe('New species: Bluegill (Common)')
  const withGill = recordCatch(withTuna, gill)
  expect(catchNews(withGill, { ...gill, id: 'g2', weightLb: 0.5 })).toMatch(/Personal best: Bluegill/)
  expect(catchNews(withGill, { ...gill, id: 'g3', weightLb: 0.2 })).toBeNull()
})

test('top keeps the ten heaviest, heaviest first', async () => {
  let save = EMPTY_SAVE
  for (let i = 0; i < 12; i++) save = recordCatch(save, { ...gill, id: `g${i}`, weightLb: i + 1 })
  expect(save.top).toHaveLength(10)
  expect(save.top[0]?.weightLb).toBe(12)
  expect(formatTop(save).split('\n')[0]).toContain('(top 10)')
  expect(formatTop(save).split('\n')[1]).toMatch(/^ +1\. Bluegill/)
})

test('an older save without a top list gets one from its recent catches', async () => {
  const older = { ...recordCatch(recordCatch(EMPTY_SAVE, gill), tuna), top: undefined }
  expect(toSave(older).top.map(one => one.name)).toEqual(['Bluefin Tuna', 'Bluegill'])
})

test('a size tag is explained the first time it is earned, then never again', async () => {
  const big = { ...gill, id: 'g9', weightLb: 1 }
  expect(gradeIntro(EMPTY_SAVE, big)?.text).toBe('First TROPHY: only about 1 in 30 Bluegill weigh this much')
  expect(gradeIntro({ ...EMPTY_SAVE, seenGrades: ['trophy'] }, big)).toBeNull()
  expect(gradeIntro(EMPTY_SAVE, gill)).toBeNull()
  const coelacanth = {
    ...gill,
    id: 'c1',
    species: 'coelacanth',
    name: 'Coelacanth',
    rarity: 'legendary',
    weightLb: 220,
  } as const
  expect(gradeIntro(EMPTY_SAVE, coelacanth)?.text).toBe('First BIG: only about 1 in 10 Coelacanth weigh this much')
  expect(gradeIntro(EMPTY_SAVE, { ...coelacanth, weightLb: 250 })?.text).toBe(
    'First ★ RECORD: only about 1 in 60 Coelacanth weigh this much',
  )
  expect(formatHelp()).toContain('TROPHY     the heaviest 1 in 30')
  expect(formatHelp()).toContain('★ RECORD   the heaviest 1 in 60')
})

test('catches of species no longer in the game are dropped from an old save', async () => {
  const ghost = { ...gill, id: 'x1', species: 'regex-eel', name: 'Regex Eel', weightLb: 9 }
  const old = { ...recordCatch(recordCatch(EMPTY_SAVE, gill), ghost) }
  const cleaned = toSave(old)
  expect(cleaned.top.map(one => one.name)).toEqual(['Bluegill'])
  expect(cleaned.recent.map(one => one.name)).toEqual(['Bluegill'])
  expect(cleaned.biggest?.name).toBe('Bluegill')
  expect(Object.keys(cleaned.species)).toEqual(['bluegill'])
})

test('dropping old fish refills the top list from recent catches and fixes the count', async () => {
  const ghost = { ...gill, id: 'x1', species: 'regex-eel', name: 'Regex Eel', weightLb: 9 }
  let save = recordCatch(EMPTY_SAVE, ghost)
  for (let i = 0; i < 12; i++) save = recordCatch(save, { ...gill, id: `g${i}`, weightLb: 0.1 + i / 100 })
  // The stored top 10 holds the ghost plus nine bluegills; three more bluegills only sit in recent.
  const cleaned = toSave(save)
  expect(cleaned.top).toHaveLength(10)
  expect(cleaned.top.every(one => one.name === 'Bluegill')).toBe(true)
  expect(cleaned.totalCaught).toBe(12)
  expect(Math.abs(cleaned.totalWeightLb - (save.totalWeightLb - 9))).toBeLessThan(0.01)
  expect(
    formatRare(cleaned)
      .split('\n')
      .every(line => line === line.trimEnd()),
  ).toBe(true)
})

test('landing a fish records it, says what is new, and explains a first size tag once', async () => {
  const hooked: Hooked = {
    id: 'h1',
    species: 'largemouth-bass',
    name: 'Largemouth Bass',
    rarity: 'common',
    lengthIn: 22,
    weightLb: 5,
    difficulty: 0.4,
  }
  const first = landFish(EMPTY_SAVE, hooked, '2026-11-11T00:00:00.000Z')
  expect(first.caught).toEqual({
    id: 'h1',
    species: 'largemouth-bass',
    name: 'Largemouth Bass',
    rarity: 'common',
    lengthIn: 22,
    weightLb: 5,
    caughtAt: '2026-11-11T00:00:00.000Z',
  })
  expect(first.isNewSpecies).toBe(true)
  expect(first.save.totalCaught).toBe(1)
  expect(first.save.seenGrades).toEqual(['big'])
  expect(first.news).toBe(
    'MegaBite record: Largemouth Bass, 5.0 lb! · First BIG: only about 1 in 10 Largemouth Bass weigh this much',
  )

  const second = landFish(first.save, { ...hooked, id: 'h2', weightLb: 4.5 }, '2026-11-11T00:01:00.000Z')
  expect(second.isNewSpecies).toBe(false)
  expect(second.news).toBe('')
  expect(second.save.seenGrades).toEqual(['big'])
})

test('a damaged save loads as what can still be read', async () => {
  const damaged = {
    version: 1,
    totalCaught: 'many',
    totalEscaped: -3,
    totalWeightLb: null,
    species: { bluegill: { count: 2, bestWeightLb: 0.4, bestLengthIn: 8 }, 'yellow-perch': 'x' },
    biggest: {},
    recent: [null, 5, gill, { ...gill, id: 'g2', weightLb: 'heavy' }],
    top: 'none',
    seenGrades: ['big', 'huge'],
  }
  const loaded = toSave(damaged)
  expect(loaded.recent.map(one => one.id)).toEqual(['g1'])
  expect(loaded.top.map(one => one.id)).toEqual(['g1'])
  expect(loaded.biggest?.id).toBe('g1')
  expect(Object.keys(loaded.species)).toEqual(['bluegill'])
  expect(loaded.totalCaught).toBe(2)
  expect(loaded.totalEscaped).toBe(0)
  expect(loaded.totalWeightLb).toBe(0)
  expect(loaded.seenGrades).toEqual(['big'])
  expect(toSave('nonsense')).toEqual(EMPTY_SAVE)
})

test('a damaged catch of a species still in the game keeps its weight in the total', async () => {
  const both = recordCatch(recordCatch(EMPTY_SAVE, gill), { ...gill, id: 'g2', weightLb: 2 })
  const { id: _, ...noId } = both.recent[0]!
  const loaded = toSave({ ...both, recent: [noId, both.recent[1]] })
  expect(loaded.totalCaught).toBe(2)
  expect(loaded.totalWeightLb).toBe(2.3)
})

test('stored catches show their species as the game has it now', async () => {
  const stale = { ...gill, name: 'Blue Gill', rarity: 'rare' }
  const loaded = toSave({ ...recordCatch(EMPTY_SAVE, gill), recent: [stale], top: [stale], biggest: stale })
  for (const one of [loaded.recent[0], loaded.top[0], loaded.biggest]) {
    expect(one?.name).toBe('Bluegill')
    expect(one?.rarity).toBe('common')
  }
})

test('a save from a later MegaBite is told apart from a damaged one', async () => {
  expect(isNewerSave({ version: 2 })).toBe(true)
  expect(isNewerSave({ version: 1 })).toBe(false)
  expect(isNewerSave({ version: 'x' })).toBe(false)
  expect(isNewerSave(null)).toBe(false)
  expect(isNewerSave(undefined)).toBe(false)
})
