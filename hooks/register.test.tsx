import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { UiPane } from 'claude-code'

import type { Save } from '../types'
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
  // An in-memory store that also lets the test read what was written.
  const seen: { saved: Save | null } = { saved: null }
  on('store.get', (_, e) => ({ value: e.key === 'save' ? (seen.saved ?? undefined) : undefined }))
  on('store.set', (_, e) => {
    if (e.key === 'save') seen.saved = e.value as Save
    return { value: undefined }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(PANE)
  await ui.post({ type: 'bite', distance: 0.5, id: 'f1' })
  await ui.post({ type: 'land', id: 'f1' })

  expect(seen.saved?.totalCaught).toBe(1)
  expect(seen.saved?.recent[0]?.id).toBe('f1')
  // The first catch is always the heaviest so far.
  expect(toasts[0]).toMatch(/MegaBite record/)
  expect(JSON.stringify(await ui.drawn())).toContain('1/50')
  expect(JSON.stringify(await ui.drawn())).toContain(seen.saved?.recent[0]?.name ?? 'missing')
  await ui.unmount()
})

test('a repeated bite keeps the fish already rolled; a land for another fish is ignored', async ($, on) => {
  const saved: { value?: Save } = {}
  on('store.get', (_, e) => ({ value: e.key === 'save' ? saved.value : undefined }))
  on('store.set', (_, e) => ((saved.value = e.key === 'save' ? (e.value as Save) : saved.value), { value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  let rolls = 0
  on('state.set', (_, e, next) => {
    if (e.key === 'hooked' && e.value !== null) rolls++
    return next(e)
  })
  const ui = await $.ui.mount(PANE)
  await ui.post({ type: 'bite', distance: 0.5, id: 'f1' })
  await ui.post({ type: 'bite', distance: 0.5, id: 'f1' })
  expect(rolls).toBe(1)

  await ui.post({ type: 'land', id: 'other' })
  expect(saved.value).toBeUndefined()
  await ui.post({ type: 'land', id: 'f1' })
  await ui.post({ type: 'land', id: 'f1' })
  expect(saved.value?.totalCaught).toBe(1)
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

// The engine's list of open panes, while the test stands in for opening one.
const PANE_UP: readonly UiPane[] = [
  { id: 'megabite', title: 'MegaBite', isShown: true, isFocused: true, isPlaced: true },
]

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
  on('ui.panes', () => ({ value: PANE_UP }))
  on('ui.close', () => ({ value: undefined }))
  on('command.register', () => ({ value: { command: 'fish' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '', reason: 'answer' }))
  on('command.run', () => ({}))
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
  await ui.advance(100)
  expect(stored.sound).toBe(true)
  await $.turn.complete({ turnId: 't2', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  expect(played).toHaveLength(1)

  // Land a fish, then close from the game: the recap reports the outing.
  await ui.post({ type: 'bite', distance: 0.5, id: 'f1' })
  await ui.post({ type: 'land', id: 'f1' })
  await ui.key({ key: 'q', in: 'game' })
  await ui.advance(100)
  expect(logged).toHaveLength(1)
  expect(logged[0]).toMatch(/^MegaBite recap: 1 caught · 1 new species · best /)
  await ui.unmount()
})

// Opens the game the way /fish does, with the store, toasts and log kept in memory.
const openGame = async (
  $: Parameters<TestBody>[0],
  on: Parameters<TestBody>[1],
  panes: readonly UiPane[] = PANE_UP,
) => {
  const stored: Record<string, unknown> = {}
  const logged: string[] = []
  const played: unknown[] = []
  const opened: unknown[] = []
  const toasts: string[] = []
  const registered: unknown[] = []
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('store.set', (_, e) => ((stored[e.key] = e.value), { value: undefined }))
  on('ui.log', (_, e) => (logged.push(String((e as { text?: unknown }).text)), { value: undefined }))
  on('audio.play', (_, e) => (played.push(e), { value: undefined }))
  on('ui.toast', (_, e) => (toasts.push(String((e as { text?: unknown }).text ?? e)), { value: undefined }))
  on('ui.open', (_, e) => (opened.push(e), { value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: panes }))
  on('ui.close', () => ({ value: undefined }))
  on('command.register', (_, e) => (registered.push(e), { value: { command: 'fish' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '', reason: 'answer' }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const fish = (args: string) =>
    $.command.run({
      command: 'fish',
      args,
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 120 },
    } as Parameters<typeof $.command.run>[0])
  return { stored, logged, played, opened, toasts, registered, fish }
}

test('closing the pane mid-fight counts the fish as got away', async ($, on) => {
  const { stored, logged, fish } = await openGame($, on)
  await fish('')
  const ui = await $.ui.mount(PANE)
  await ui.post({ type: 'bite', distance: 0.5, id: 'f1' })
  await ui.post({ type: 'close' })
  expect((stored.save as Save | undefined)?.totalEscaped).toBe(1)
  expect(logged).toEqual(['MegaBite recap: 0 caught · 1 got away'])
  await ui.unmount()
})

test('a pane the engine dropped no longer flashes or chimes', async ($, on) => {
  const { played, fish } = await openGame($, on, [])
  await fish('unmute')
  await fish('')
  await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  expect(played).toHaveLength(0)
})

test('/fish options answer in text, and an unknown one does not open the game', async ($, on) => {
  const { stored, opened, fish } = await openGame($, on)
  expect(JSON.stringify(await fish('stats'))).toContain('Caught 0 (0 got away)')
  expect(JSON.stringify(await fish('dex'))).toContain('0/50 species')
  expect(JSON.stringify(await fish('top'))).toContain('nothing landed yet')
  expect(JSON.stringify(await fish('unmute'))).toContain('unmuted')
  expect(stored.sound).toBe(true)
  expect(JSON.stringify(await fish('mute'))).toContain('muted')
  expect(stored.sound).toBe(false)
  expect(JSON.stringify(await fish('stat'))).toContain('MegaBite has no \\"/fish stat\\"')
  expect(opened).toHaveLength(0)
})

test('/fish runs mid-turn, ignores case, and says when there is nothing to close', async ($, on) => {
  const { registered, fish } = await openGame($, on, [])
  expect(registered).toContainEqual(expect.objectContaining({ name: 'fish', immediate: true }))
  expect(JSON.stringify(await fish('  STATS '))).toContain('Caught 0 (0 got away)')
  expect(JSON.stringify(await fish('sound   ON'))).toContain('unmuted')
  expect(JSON.stringify(await fish('close'))).toContain('MegaBite is not open.')
})

test('a save from a later MegaBite is never written over; the game still counts the catch', async ($, on) => {
  const later = { version: 2, anything: 'kept' }
  const { stored, toasts, fish } = await openGame($, on)
  stored.save = later
  await fish('')
  const ui = await $.ui.mount(PANE)
  await ui.post({ type: 'bite', distance: 0.5, id: 'f1' })
  await ui.post({ type: 'land', id: 'f1' })
  expect(stored.save).toEqual(later)
  expect(toasts.some(text => text.includes('newer MegaBite'))).toBe(true)
  expect(JSON.stringify(await ui.drawn())).toContain('1/50')
  await ui.unmount()
})

test('an outing whose pane the engine dropped is closed out at the next /fish', async ($, on) => {
  const { stored, logged, fish } = await openGame($, on, [])
  await fish('')
  const ui = await $.ui.mount(PANE)
  await ui.post({ type: 'bite', distance: 0.5, id: 'f1' })
  await ui.unmount()
  await fish('')
  expect((stored.save as Save | undefined)?.totalEscaped).toBe(1)
  expect(logged).toEqual(['MegaBite recap: 0 caught · 1 got away'])
})

test('a landing and a close that overlap count the fish once', async ($, on) => {
  const { stored, fish } = await openGame($, on)
  await fish('')
  const ui = await $.ui.mount(PANE)
  await ui.post({ type: 'bite', distance: 0.5, id: 'f1' })
  await Promise.all([ui.post({ type: 'land', id: 'f1' }), ui.post({ type: 'close' })])
  const saved = stored.save as Save | undefined
  expect((saved?.totalCaught ?? 0) + (saved?.totalEscaped ?? 0)).toBe(1)
  await ui.unmount()
})

test("another session's catches reach the open pane when Claude finishes", async ($, on) => {
  const { stored, fish } = await openGame($, on)
  await fish('')
  const ui = await $.ui.mount(PANE)
  expect(JSON.stringify(await ui.drawn())).not.toContain('Golden Trout')
  stored.save = recordCatch(EMPTY_SAVE, trout)
  await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  expect(JSON.stringify(await ui.drawn())).toContain('Golden Trout')
  await ui.unmount()
})
