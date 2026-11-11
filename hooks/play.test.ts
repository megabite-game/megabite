import { expect, test } from 'claude-code/testing'
import type { ClientSurface } from 'claude-code'

import type { GameProps } from '../types'
import { flush, initial, latest, send } from './play'
import type { State } from './play'

const PROPS: GameProps = {
  hooked: null,
  last: null,
  lastGrade: null,
  isClaudeBusy: false,
  claudeDoneCount: 0,
  rare: [],
  heavy: [],
}

// A stand-in surface that records what the game posts.
const fakeSurface = (): { surface: ClientSurface<State>; posts: unknown[] } => {
  const posts: unknown[] = []
  const surface = { state: initial(), setState: () => undefined, post: (data: unknown) => posts.push(data) }
  return { surface: surface as unknown as ClientSurface<State>, posts }
}

test('a message is posted each tick until the props show it arrived, one at a time', async () => {
  const { surface, posts } = fakeSurface()
  latest.set(surface, PROPS)
  send(surface, { type: 'bite', distance: 0.5, id: 'f1' })
  send(surface, { type: 'sound' })
  flush(surface)
  flush(surface)
  // The bite went unanswered, so it went again, and the mute waited behind it.
  expect(posts).toEqual([
    { type: 'bite', distance: 0.5, id: 'f1' },
    { type: 'bite', distance: 0.5, id: 'f1' },
  ])

  latest.set(surface, { ...PROPS, hooked: { id: 'f1', difficulty: 0.5, rarity: 'common' } })
  flush(surface)
  flush(surface)
  expect(posts.slice(2)).toEqual([{ type: 'sound' }])
})

test('a land nobody answers is given up after about five seconds', async () => {
  const { surface, posts } = fakeSurface()
  latest.set(surface, PROPS)
  send(surface, { type: 'land', id: 'f1' })
  for (let i = 0; i < 80; i++) flush(surface)
  expect(posts).toHaveLength(50)
})
