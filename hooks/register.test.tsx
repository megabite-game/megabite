import { expect, test } from 'claude-code/testing'

import type { Hooked } from '../types'
import { gill, trout } from './fixtures'
import { EMPTY_SAVE, recordCatch } from './save'

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
      seen.fish =
        written && 'id' in written ? written : ((written as { value?: Hooked | null } | null)?.value ?? seen.fish)
    }
    return next(e)
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(PANE)
  await ui.post({ type: 'bite', distance: 0.5 })
  expect(seen.fish).not.toBeNull()

  await ui.post({ type: 'land', id: seen.fish?.id ?? '' })

  expect(seen.saved?.totalCaught).toBe(1)
  expect(seen.saved?.recent[0]?.id).toBe(seen.fish?.id)
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
  await $.command.run({
    command: 'fish',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 120 },
  } as Parameters<typeof $.command.run>[0])
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
