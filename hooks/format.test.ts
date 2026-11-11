import { expect, test } from 'claude-code/testing'

import { gill, trout, tuna } from './fixtures'
import { formatDex, formatOuting, formatRare } from './format'
import { addCatchToOuting, EMPTY_OUTING, EMPTY_SAVE, recordCatch } from './save'

test('dex shows caught species with their best and hides the rest', async () => {
  const dex = formatDex(recordCatch(EMPTY_SAVE, trout))
  expect(dex).toContain('1/50 species')
  expect(dex).toContain('Legendary 1/4')
  expect(dex).toMatch(/Golden Trout +11.2 oz +11.0 in +1 caught/)
  expect(dex).not.toContain('Bluegill')
  // Golden Trout (shore) caught; the other three legendaries are two deep and one anywhere.
  expect(dex).toContain('+3 undiscovered: 1 anywhere, 2 deep')
  expect(dex).toContain('+15 undiscovered: 6 near shore, 8 anywhere, 1 deep')
  expect(dex.split('\n')).toHaveLength(12)
})

test('/fish rare lists rarest tier first, heaviest first within a tier', async () => {
  const save = recordCatch(recordCatch(recordCatch(EMPTY_SAVE, gill), tuna), trout)
  const lines = formatRare(save).split('\n')
  expect(lines[1]).toMatch(/Legendary +Golden Trout/)
  expect(lines[2]).toMatch(/Epic +Bluefin Tuna/)
  expect(lines[3]).toMatch(/Common +Bluegill/)
  expect(formatRare(EMPTY_SAVE)).toMatch(/nothing landed yet/)
})

test('the recap sums the outing and says nothing when nothing happened', async () => {
  expect(formatOuting(EMPTY_OUTING)).toBeNull()
  const outing = addCatchToOuting(
    addCatchToOuting({ ...EMPTY_OUTING, escaped: 1 }, gill, true),
    { ...gill, id: 'g2', weightLb: 0.7 },
    false,
  )
  expect(formatOuting(outing)).toBe(
    'MegaBite recap: 2 caught · 1 new species · 1 got away · best TROPHY Bluegill 11.2 oz',
  )
})
