import { expect, test } from 'claude-code/testing'

import type { Hooked } from '../types'
import { addCatchToOuting, catchNews, EMPTY_OUTING, EMPTY_SAVE, formatOuting, formatDex, formatHelp, formatRare, formatTop, gradeIntro, sizeGrade, pickSpecies, rarest, recordCatch, rollFish, SPECIES, toSave } from './fish'

const PANE = {
  plugin: 'megabite',
  component: 'Pane',
  requestId: 'megabite',
  surface: 'terminal',
  props: {
    title: 'MegaBite',
    isFocused: true,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

// Deterministic stand-in for Math.random.
const seeded = (seed: number): (() => number) => {
  let x = seed
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x / 2147483648
  }
}

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

test('the record is the heaviest catch', async () => {
  const base = { rarity: 'common', isTrophy: false, caughtAt: '2026-11-11T00:00:00.000Z' } as const
  const one = recordCatch(EMPTY_SAVE, { ...base, id: 'a', species: 'largemouth-bass', name: 'Largemouth Bass', lengthIn: 14, weightLb: 1.5 })
  const two = recordCatch(one, { ...base, id: 'b', species: 'common-carp', name: 'Common Carp', lengthIn: 20, weightLb: 5 })
  const three = recordCatch(two, { ...base, id: 'c', species: 'bluegill', name: 'Bluegill', lengthIn: 7, weightLb: 0.3 })
  expect(three.biggest?.id).toBe('b')
  expect(three.totalCaught).toBe(3)
  expect(three.species['largemouth-bass'].count).toBe(1)
  expect(three.recent[0].id).toBe('c')
})

test('a landed fish is saved to the store and shown in the pane', async ($, on) => {
  on('command.register', () => ({ value: { command: 'fish' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const toasts: string[] = []
  on('ui.toast', (_, e) => (toasts.push(String((e as { text?: unknown }).text ?? e)), { value: undefined }))
  const seen: { saved: typeof EMPTY_SAVE | null; fish: Hooked | null } = { saved: null, fish: null }
  // An in-memory store that also lets the test read what was written.
  on('store.get', (_, e) => ({ value: e.key === 'save' ? (seen.saved ?? undefined) : undefined }))
  on('store.set', (_, e) => {
    if (e.key === 'save') seen.saved = e.value as typeof EMPTY_SAVE
    return { value: undefined }
  })
  // Watch the mod's writes to learn which fish it hooked.
  on('state.set', (_, e, next) => {
    if (e.key === 'hooked') {
      const written = e.value as { value?: Hooked | null } | Hooked | null
      seen.fish = written && 'id' in written ? written : (written as { value?: Hooked | null } | null)?.value ?? seen.fish
    }
    return next(e)
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(PANE)
  await ui.post({ type: 'bite', distance: 0.5 })
  expect(seen.fish).not.toBeNull()

  await ui.post({ type: 'land', id: seen.fish?.id ?? '' })

  expect(seen.saved?.totalCaught).toBe(1)
  expect(seen.saved?.recent[0].id).toBe(seen.fish?.id)
  // The first catch is always the heaviest so far.
  expect(toasts[0]).toMatch(/MegaBite record/)
  expect(JSON.stringify(await ui.drawn())).toContain('1/50')
  expect(JSON.stringify(await ui.drawn())).toContain(seen.fish?.name ?? 'missing')
  await ui.unmount()
})

test('a save from an earlier session is loaded at start', async ($, on) => {
  on('command.register', () => ({ value: { command: 'fish' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const earlier = recordCatch(EMPTY_SAVE, {
    id: 'old',
    species: 'northern-pike',
    name: 'Northern Pike',
    rarity: 'rare',
    lengthIn: 31,
    weightLb: 8.4,
    isTrophy: false,
    caughtAt: '2026-11-01T00:00:00.000Z',
  })
  on('store.get', (_, e) => ({ value: e.key === 'save' ? earlier : undefined }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(PANE)
  expect(JSON.stringify(await ui.drawn())).toContain('Northern Pike 8.4 lb')
  await ui.unmount()
})

// The game's own drawing, flattened to its words.
const gameText = async (ui: { drawn: (scope?: { in?: string }) => Promise<unknown> }): Promise<string> =>
  JSON.stringify(await ui.drawn({ in: 'game' }))

test('the game charges on Enter, casts on the second press, then waits for a bite', async ($, on) => {
  on('store.get', () => ({ value: undefined }))
  const ui = await $.ui.mount(PANE)
  await ui.advance(100)
  expect(await gameText(ui)).toContain(' cast')

  await ui.key({ key: 'return', in: 'game' })
  expect(await gameText(ui)).toContain('░')

  await ui.key({ key: ' ', in: 'game' })
  expect(await gameText(ui)).toContain('→')

  await ui.advance(1000)
  expect(await gameText(ui)).toContain('●')
  await ui.unmount()
})

test('left arrow lets line out while reeling, and does nothing before a bite', async ($, on) => {
  on('store.get', () => ({ value: undefined }))
  const ui = await $.ui.mount(PANE)
  await ui.advance(100)
  await ui.key({ key: 'left', in: 'game' })
  expect(await gameText(ui)).toContain(' cast')

  await ui.key({ key: ' ', in: 'game' })
  await ui.key({ key: ' ', in: 'game' })
  for (let i = 0; i < 100 && !(await gameText(ui)).includes(' ! '); i++) await ui.advance(100)
  await ui.key({ key: ' ', in: 'game' })
  expect(await gameText(ui)).toContain('◆')

  // Five taps of left from the starting tension leave the marker at the slack end.
  for (let i = 0; i < 5; i++) await ui.key({ key: 'left', in: 'game' })
  expect(await gameText(ui)).toMatch(/"◆"/)
  const drawn = await gameText(ui)
  const gauge = drawn.slice(drawn.indexOf('" ← "'), drawn.indexOf('" ␣ "'))
  expect(gauge.indexOf('◆')).toBeLessThan(gauge.indexOf('━'))
  await ui.unmount()
})

test('q in the game closes the pane', async ($, on) => {
  on('store.get', () => ({ value: undefined }))
  const closed: unknown[] = []
  on('ui.close', (_, e) => (closed.push(e), { value: undefined }))
  const ui = await $.ui.mount(PANE)
  await ui.advance(100)
  await ui.key({ key: 'q', in: 'game' })
  await ui.advance(100)
  expect(closed).toHaveLength(1)
  await ui.unmount()
})

const caughtAt = '2026-11-11T00:00:00.000Z'
const trout = { id: 't1', species: 'golden-trout', name: 'Golden Trout', rarity: 'legendary', lengthIn: 11, weightLb: 0.7, isTrophy: false, caughtAt } as const
const tuna = { id: 'b1', species: 'bluefin-tuna', name: 'Bluefin Tuna', rarity: 'epic', lengthIn: 82, weightLb: 430, isTrophy: false, caughtAt } as const
const gill = { id: 'g1', species: 'bluegill', name: 'Bluegill', rarity: 'common', lengthIn: 7, weightLb: 0.3, isTrophy: false, caughtAt } as const

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

test('top keeps the ten heaviest, heaviest first', async () => {
  let save = EMPTY_SAVE
  for (let i = 0; i < 12; i++) save = recordCatch(save, { ...gill, id: `g${i}`, weightLb: i + 1 })
  expect(save.top).toHaveLength(10)
  expect(save.top[0].weightLb).toBe(12)
  expect(formatTop(save).split('\n')[0]).toContain('(top 10)')
  expect(formatTop(save).split('\n')[1]).toMatch(/^ +1\. Bluegill/)
})

test('an older save without a top list gets one from its recent catches', async () => {
  const older = { ...recordCatch(recordCatch(EMPTY_SAVE, gill), tuna), top: undefined }
  expect(toSave(older).top.map(one => one.name)).toEqual(['Bluefin Tuna', 'Bluegill'])
})

test('/fish rare lists rarest tier first, heaviest first within a tier', async () => {
  const save = recordCatch(recordCatch(recordCatch(EMPTY_SAVE, gill), tuna), trout)
  const lines = formatRare(save).split('\n')
  expect(lines[1]).toMatch(/Legendary +Golden Trout/)
  expect(lines[2]).toMatch(/Epic +Bluefin Tuna/)
  expect(lines[3]).toMatch(/Common +Bluegill/)
  expect(formatRare(EMPTY_SAVE)).toMatch(/nothing landed yet/)
})

test('tab cycles water, rarest and heaviest, coloured by tier', async ($, on) => {
  const save = recordCatch(recordCatch(EMPTY_SAVE, gill), trout)
  on('store.get', (_, e) => ({ value: e.key === 'save' ? save : undefined }))
  on('command.register', () => ({ value: { command: 'fish' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(PANE)
  await ui.advance(100)

  await ui.key({ key: 'tab', in: 'game' })
  const view = await gameText(ui)
  expect(view).toContain('Rarest')
  expect(view).toContain('#ffca28')
  expect(view.indexOf('Golden Trout')).toBeLessThan(view.indexOf('Bluegill'))

  await ui.key({ key: 'tab', in: 'game' })
  const heavy = await gameText(ui)
  expect(heavy).toContain('Heaviest')
  expect(heavy.indexOf('Golden Trout')).toBeLessThan(heavy.indexOf('Bluegill'))

  await ui.key({ key: 'tab', in: 'game' })
  expect(await gameText(ui)).toContain(' cast')
  await ui.unmount()
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
  expect(formatRare(recordCatch(EMPTY_SAVE, { ...gill, weightLb: 0.7 }))).toContain('TROPHY')
  // Heaviest is weight only, so its order and its labels never disagree.
  expect(formatTop(recordCatch(EMPTY_SAVE, { ...gill, weightLb: 0.7 }))).not.toContain('TROPHY')
})

test('tab mid-cast reels in and shows records; a click never casts', async ($, on) => {
  on('store.get', () => ({ value: undefined }))
  const ui = await $.ui.mount(PANE)
  await ui.advance(100)
  await ui.pointer({ type: 'down', x: 5, y: 2, button: 'left', in: 'game' })
  expect(await gameText(ui)).toContain(' cast')

  await ui.key({ key: ' ', in: 'game' })
  await ui.key({ key: ' ', in: 'game' })
  await ui.advance(1000)
  await ui.key({ key: 'tab', in: 'game' })
  expect(await gameText(ui)).toContain('Rarest')
  await ui.key({ key: ' ', in: 'game' })
  expect(await gameText(ui)).toContain(' cast')
  await ui.unmount()
})

test('a size tag is explained the first time it is earned, then never again', async () => {
  const big = { ...gill, id: 'g9', weightLb: 0.7 }
  expect(gradeIntro(EMPTY_SAVE, big)?.text).toBe("First TROPHY: at least 2× a typical Bluegill's weight")
  expect(gradeIntro({ ...EMPTY_SAVE, seenGrades: ['trophy'] }, big)).toBeNull()
  expect(gradeIntro(EMPTY_SAVE, gill)).toBeNull()
  expect(formatHelp()).toContain('TROPHY     2× typical or more')
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
  expect(formatRare(cleaned).split('\n').every(line => line === line.trimEnd())).toBe(true)
})

test('the recap sums the outing and says nothing when nothing happened', async () => {
  expect(formatOuting(EMPTY_OUTING)).toBeNull()
  const outing = addCatchToOuting(addCatchToOuting({ ...EMPTY_OUTING, escaped: 1 }, gill, true), { ...gill, id: 'g2', weightLb: 0.7 }, false)
  expect(formatOuting(outing)).toBe('MegaBite recap: 2 caught · 1 new species · 1 got away · best TROPHY Bluegill 11.2 oz')
})

test('Claude finishing chimes only when sound is on, flashes the open game, and closing logs a recap', async ($, on) => {
  const played: unknown[] = []
  const logged: string[] = []
  const stored: Record<string, unknown> = {}
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('store.set', (_, e) => ((stored[e.key] = e.value), { value: undefined }))
  on('audio.play', (_, e) => (played.push(e), { value: undefined }))
  on('ui.log', (_, e) => (logged.push(String((e as { text?: unknown }).text)), { value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('command.register', () => ({ value: { command: 'fish' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '', reason: 'answer' }))
  on('command.run', () => ({}))
  const hookedFish: { id: string | null } = { id: null }
  on('state.set', (_, e, next) => {
    if (e.key === 'hooked') {
      const written = e.value as { id?: string } | { value?: { id?: string } } | null
      const id = written && 'id' in written ? written.id : (written as { value?: { id?: string } } | null)?.value?.id
      if (id) hookedFish.id = id
    }
    return next(e)
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'fish', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as Parameters<typeof $.command.run>[0])
  const ui = await $.ui.mount(PANE)
  await ui.advance(100)

  await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  expect(played).toHaveLength(0)
  await ui.advance(100)
  expect(await gameText(ui)).toContain('Claude done')

  await ui.key({ key: 'm', in: 'game' })
  expect(stored.sound).toBe(true)
  await $.turn.complete({ turnId: 't2', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  expect(played).toHaveLength(1)

  // Land a fish, then close from the game: the recap reports the outing.
  await ui.post({ type: 'bite', distance: 0.5 })
  await ui.post({ type: 'land', id: hookedFish.id ?? '' })
  await ui.key({ key: 'q', in: 'game' })
  await ui.advance(100)
  expect(logged).toHaveLength(1)
  expect(logged[0]).toMatch(/^MegaBite recap: 1 caught · 1 new species · best /)
  await ui.unmount()
})
