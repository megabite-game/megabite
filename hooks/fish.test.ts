import { expect, test } from 'claude-code/testing'

import { gill, mixed, seeded } from './fixtures'
import { gradeLines, pickSpecies, RECORD_SHARE, rollFish, sizeGrade, SPECIES } from './fish'
import { formatRare, formatTop } from './format'
import { EMPTY_SAVE, recordCatch } from './save'

test('rolled fish stay within their species bounds and weigh in with length', async () => {
  const random = seeded(7)
  for (let i = 0; i < 2000; i++) {
    const fish = rollFish(random(), random, `f${i}`)
    const species = SPECIES.find(one => one.id === fish.species)
    expect(species).toBeDefined()
    expect(fish.lengthIn).toBeLessThanOrEqual(species?.maxLengthIn ?? 0)
    expect(fish.lengthIn).toBeGreaterThan(0)
    expect(fish.weightLb).toBeGreaterThan(0)
    expect(fish.difficulty).toBeGreaterThanOrEqual(0)
    expect(fish.difficulty).toBeLessThanOrEqual(1)
  }
})

test('50 species with unique ids across five tiers', async () => {
  expect(SPECIES).toHaveLength(50)
  expect(new Set(SPECIES.map(one => one.id)).size).toBe(50)
  const tiers = new Set(SPECIES.map(one => one.rarity))
  expect([...tiers].sort()).toEqual(['common', 'epic', 'legendary', 'rare', 'uncommon'])
})

test('short casts find more shore fish and long casts more deep fish', async () => {
  const random = seeded(11)
  const share = (distance: number, habitat: string): number => {
    let hits = 0
    for (let i = 0; i < 4000; i++) if (pickSpecies(distance, random).habitat === habitat) hits++
    return hits / 4000
  }
  expect(share(0, 'shore')).toBeGreaterThan(share(1, 'shore') * 2)
  expect(share(1, 'deep')).toBeGreaterThan(share(0, 'deep') * 2)
})

test('size grades are relative to the species, not raw pounds', async () => {
  // Bluegill: typical 0.3 lb, can roll to about 3 lb.
  expect(sizeGrade('bluegill', 0.3)).toBeNull()
  expect(sizeGrade('bluegill', 0.4)).toBe('big')
  expect(sizeGrade('bluegill', 0.7)).toBe('trophy')
  expect(sizeGrade('bluegill', 2.6)).toBe('record')
  // A 145 lb yellowfin is only big for a tuna that runs 60 lb typical.
  expect(sizeGrade('yellowfin-tuna', 145)).toBe('trophy')
  expect(sizeGrade('bluefin-tuna', 430)).toBeNull()
  // A coelacanth runs 100 lb and tops out near its cap, so its record line sits close to it.
  expect(sizeGrade('coelacanth', 150)).toBe('big')
  expect(sizeGrade('coelacanth', 210)).toBe('trophy')
  expect(sizeGrade('coelacanth', 250)).toBe('record')
  expect(formatRare(recordCatch(EMPTY_SAVE, { ...gill, weightLb: 0.7 }))).toContain('TROPHY')
  // Heaviest is weight only, so its order and its labels never disagree.
  expect(formatTop(recordCatch(EMPTY_SAVE, { ...gill, weightLb: 0.7 }))).not.toContain('TROPHY')
})

test('every species earns RECORD about as often, whether its cap is near its typical size or far', async () => {
  for (const species of SPECIES) {
    const lines = gradeLines(species.id)
    expect(lines).not.toBeNull()
    if (!lines) continue
    expect(lines.big).toBeLessThan(lines.trophy)
    expect(lines.trophy).toBeLessThan(lines.record)
  }
  const random = mixed(23)
  const rolls = new Map<string, { n: number; records: number }>()
  for (let i = 0; i < 60000; i++) {
    const fish = rollFish(random(), random, 'x')
    const seen = rolls.get(fish.species) ?? { n: 0, records: 0 }
    seen.n += 1
    if (sizeGrade(fish.species, fish.weightLb) === 'record') seen.records += 1
    rolls.set(fish.species, seen)
  }
  // Arapaima, Coelacanth and Mekong Giant Catfish (caps near typical) once tagged 15-20%; Rainbow Trout 0.002%.
  // A few hundred rolls of the rarest species leave room for chance, not for that.
  for (const [id, { n, records }] of rolls) {
    const share = records / n
    if (share < RECORD_SHARE / 4 || share > RECORD_SHARE * 2.5) throw new Error(`${id}: ${share}`)
  }
})
