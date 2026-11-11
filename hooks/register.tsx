import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { GameMessage, GameProps, Outing, Save } from '../types'
import { formatWeight, GRADE_COLOR, GRADE_LABEL, RARITY_COLOR, rollFish, sizeGrade, SPECIES } from './fish'
import { formatDex, formatHelp, formatOuting, formatRare, formatStats, formatTop, formatUnknown } from './format'
import {
  addCatchToOuting,
  EMPTY_OUTING,
  EMPTY_SAVE,
  heaviestList,
  isNewerSave,
  landFish,
  rarest,
  rarestList,
  recordEscape,
  speciesFound,
  toSave,
} from './save'

const PANE = 'megabite'
const TITLE = 'MegaBite'
const STORE_KEY = 'save'

const save = atom({ plugin: 'megabite', key: 'save' } as const, EMPTY_SAVE, { shape: 'save-2' })
const hooked = atom({ plugin: 'megabite', key: 'hooked' } as const, null, { shape: 'hooked-1' })
const last = atom({ plugin: 'megabite', key: 'last' } as const, null, { shape: 'last-1' })
const isClaudeBusy = atom({ plugin: 'megabite', key: 'isClaudeBusy' } as const, false)
const isOpen = atom({ plugin: 'megabite', key: 'isOpen' } as const, false)
const claudeDoneCount = atom({ plugin: 'megabite', key: 'claudeDoneCount' } as const, 0)
const outing = atom({ plugin: 'megabite', key: 'outing' } as const, EMPTY_OUTING, { shape: 'outing-1' })

const isSoundOn = atom({ plugin: 'megabite', key: 'isSoundOn' } as const, false)

const CHIME = 'sounds/done.wav'
const SOUND_KEY = 'sound'

const isFishId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64

const isGameMessage = (data: unknown): data is GameMessage => {
  if (typeof data !== 'object' || data === null) return false
  const { type, distance, id } = data as { type?: unknown; distance?: unknown; id?: unknown }
  if (type === 'bite') return typeof distance === 'number' && Number.isFinite(distance) && isFishId(id)
  if (type === 'land' || type === 'lost') return isFishId(id)
  return type === 'close' || type === 'sound'
}

// The engine's record of open panes, not ours: a pane the engine dropped (a reload) is gone from it
// even though no `ui.close` hook of ours ran.
const isPaneUp = async ($: EngineInterface): Promise<boolean> => (await $.ui.panes()).some(pane => pane.id === PANE)

// What the game is handed: the session's values, with the hooked fish cut to what it may see before landing.
const readGameProps = async ($: EngineInterface): Promise<GameProps> => {
  const fish = await read($, hooked)
  const caught = await read($, last)
  const busy = await read($, isClaudeBusy)
  const record = await read($, save)
  const doneCount = await read($, claudeDoneCount)
  return {
    hooked: fish ? { id: fish.id, difficulty: fish.difficulty, rarity: fish.rarity } : null,
    last: caught,
    lastGrade: caught ? sizeGrade(caught.species, caught.weightLb) : null,
    isClaudeBusy: busy,
    claudeDoneCount: doneCount,
    rare: rarestList(record, 5),
    heavy: heaviestList(record, 5),
  }
}

// The store is the record across sessions: read fresh for each command and before each write, so two
// sessions don't clobber each other.
const loadSave = async ($: EngineInterface): Promise<Save> => {
  return toSave(await $.store.get(STORE_KEY))
}

const NEWER_SAVE_NOTE =
  'MegaBite: your catch log is from a newer MegaBite, so catches here are not saved. Update the plugin.'

// Keep `next` as the catch log: in the store, unless it holds a later MegaBite's save, which is left
// whole; and in the session, so the game shows it either way.
const writeSave = async ($: EngineInterface, next: Save): Promise<void> => {
  if (isNewerSave(await $.store.get(STORE_KEY))) $.ui.toast(NEWER_SAVE_NOTE)
  else await $.store.set(STORE_KEY, next)
  await update($, save, () => next)
}

// The catch log a catch or an escape changes: the store's, or, while the store holds a later MegaBite's
// save, the session's.
const baseSave = async ($: EngineInterface): Promise<Save> => {
  const stored = await $.store.get(STORE_KEY)
  return isNewerSave(stored) ? read($, save) : toSave(stored)
}

// Hooks can overlap (a landing still saving as the pane closes), so changes to the catch log, the outing
// and the fish on the line run one at a time. Nothing run here may close the pane, or call refreshSave:
// both wait here too.
let queue: Promise<unknown> = Promise.resolve()
const oneAtATime = <T,>(work: () => Promise<T>): Promise<T> => {
  const run = queue.then(work, work)
  queue = run.catch(() => undefined)
  return run
}

// Show the store's catch log, which another session may have added to; a later MegaBite's save is left unread.
const refreshSave = ($: EngineInterface): Promise<void> =>
  oneAtATime(async () => {
    const stored = await $.store.get(STORE_KEY)
    if (isNewerSave(stored)) return
    const fresh = toSave(stored)
    await update($, save, () => fresh)
  })

// Flip the chime (or set it), remember it across sessions, and say what it is now.
const toggleSound = async ($: EngineInterface, to?: boolean): Promise<string> => {
  const on = to ?? !(await read($, isSoundOn))
  await update($, isSoundOn, () => on)
  await $.store.set(SOUND_KEY, on)
  return on ? 'MegaBite unmuted: a chime plays when Claude finishes.' : 'MegaBite muted.'
}

// The fish on the line got away: count it in the save and the outing, and let it go.
const escapeFish = async ($: EngineInterface): Promise<void> => {
  await writeSave($, recordEscape(await baseSave($)))
  await update($, hooked, () => null)
  await update($, outing, (current: Outing) => ({ ...current, escaped: current.escaped + 1 }))
}

// The outing is over: a fish still on the line got away, and a one-line recap goes to the chat.
// Only while the game counts as open, so it runs once per outing.
const endOuting = async ($: EngineInterface): Promise<void> => {
  if (!(await read($, isOpen))) return
  if (await read($, hooked)) await escapeFish($)
  const recap = formatOuting(await read($, outing))
  if (recap) $.ui.log(recap)
  await update($, isOpen, () => false)
  await update($, outing, () => EMPTY_OUTING)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'fish',
      description: 'MegaBite: open the fishing pane (`/fish help` for keys and tags)',
      argumentHint: '[help|dex|top|rare|stats|mute|unmute|sound|close]',
      // So /fish opens while Claude is working, which is when the game is for.
      immediate: true,
    })
    const stored = await loadSave($)
    await update($, save, () => stored)
    // Sound is off unless the person turned it on.
    const soundOn = (await $.store.get(SOUND_KEY)) === true
    await update($, isSoundOn, () => soundOn)

    return next(e)
  })

  on('command.run', { command: 'fish' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase().replace(/\s+/g, ' ')
    if (arg === 'close') {
      if (!(await isPaneUp($))) return { text: 'MegaBite is not open.' }
      await $.ui.close({ id: PANE })
      return { text: 'MegaBite closed.' }
    }
    if (arg === 'stats') return { text: formatStats(await loadSave($)) }
    if (arg === 'dex') return { text: formatDex(await loadSave($)) }
    if (arg === 'top') return { text: formatTop(await loadSave($)) }
    if (arg === 'rare') return { text: formatRare(await loadSave($)) }
    if (arg === 'help') return { text: formatHelp() }
    // /fish mute and /fish unmute set the chime (sound on/off kept as aliases); m in the game toggles.
    if (arg === 'mute' || arg === 'sound off') return { text: await toggleSound($, false) }
    if (arg === 'unmute' || arg === 'sound on') return { text: await toggleSound($, true) }
    if (arg === 'sound')
      return {
        text: `MegaBite is ${(await read($, isSoundOn)) ? 'unmuted' : 'muted'}. /fish mute or /fish unmute to change it.`,
      }
    if (arg !== '') return { text: formatUnknown(e.args.trim()) }
    if (!(await isPaneUp($)))
      await oneAtATime(async () => {
        // A pane the engine dropped (its drawing failed) ran no close hook: end that outing now.
        await endOuting($)
        await update($, outing, () => EMPTY_OUTING)
      })
    await refreshSave($)
    await $.ui.open({ id: PANE, title: TITLE, focus: true, closeOnEscape: true, rows: 10, columns: 48 })
    await update($, isOpen, () => true)
    return {
      text: 'MegaBite opened. Click the pane once if keys go to the chat. Space casts, Tab shows records, Esc closes. /fish help explains the rest.',
    }
  })

  // Only the main thread's turns, not subagents'.
  on('turn.start', async ($, e, next) => {
    if (!e.agentId) await update($, isClaudeBusy, () => true)
    return next(e)
  })

  // Claude finished: chime and flash the game, but only while the game is open.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId) return done
    await update($, isClaudeBusy, () => false)
    if (await isPaneUp($)) {
      await update($, claudeDoneCount, n => n + 1)
      await refreshSave($)
      if (await read($, isSoundOn)) $.audio.play({ asset: CHIME }).catch(() => undefined)
    }
    return done
  })

  // However the pane closes (Esc, q, the ✕, /fish close), end the outing.
  on('ui.close', async ($, e, next) => {
    const closed = await next(e)
    if (e.id === PANE) await oneAtATime(() => endOuting($))
    return closed
  })

  on('ui.message', { requestId: PANE }, async ($, e) => {
    if (!isGameMessage(e.data)) return {}
    const message = e.data

    if (message.type === 'close') {
      await $.ui.close({ id: PANE })
      return {}
    }
    if (message.type === 'sound') {
      $.ui.toast(await toggleSound($))
      return {}
    }

    // The game posts until the props show a message arrived, so a repeat changes nothing.
    await oneAtATime(async () => {
      if (message.type === 'bite') {
        const current = await read($, hooked)
        if (current?.id !== message.id) {
          const fish = rollFish(message.distance, Math.random, message.id)
          await update($, hooked, () => fish)
        }
      }

      if (message.type === 'land') {
        const fish = await read($, hooked)
        if (fish && fish.id === message.id) {
          const { caught, save: next, news, isNewSpecies } = landFish(await baseSave($), fish, new Date().toISOString())
          await writeSave($, next)
          await update($, last, () => caught)
          await update($, hooked, () => null)
          if (news) $.ui.toast(news)
          await update($, outing, (current: Outing) => addCatchToOuting(current, caught, isNewSpecies))
        }
      }

      if (message.type === 'lost') {
        const fish = await read($, hooked)
        if (fish && fish.id === message.id) await escapeFish($)
      }
    })

    return { props: await readGameProps($) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface !== 'terminal') {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>MegaBite plays in the terminal.</Text>
    }
    const { Box, Text, Client } = $.ui.resolve(e)
    const record = await read($, save)
    const props = await readGameProps($)
    const rare = rarest(record)
    const heaviestGrade = record.biggest ? sizeGrade(record.biggest.species, record.biggest.weightLb) : null

    return (
      <Box flexDirection="column">
        <Client key="game" module="./game.tsx" props={props} width="100%" />
        <Box flexDirection="column" paddingX={1}>
          <Box flexDirection="row">
            <Text color="#78909c">{'⚖ Heaviest  '}</Text>
            {heaviestGrade && (
              <Text color={GRADE_COLOR[heaviestGrade]} weight="bold">{`${GRADE_LABEL[heaviestGrade]} `}</Text>
            )}
            {record.biggest ? (
              <Text weight="bold">{`${record.biggest.name} ${formatWeight(record.biggest.weightLb)}`}</Text>
            ) : (
              <Text color="#78909c">—</Text>
            )}
          </Box>
          <Box flexDirection="row" justifyContent="space-between">
            <Box flexDirection="row">
              <Text color="#78909c">{'◆ Rarest    '}</Text>
              {rare ? (
                <Text color={RARITY_COLOR[rare.rarity]} weight="bold">
                  {rare.name}
                </Text>
              ) : (
                <Text color="#78909c">—</Text>
              )}
            </Box>
            <Text color="#78909c">{`${speciesFound(record)}/${SPECIES.length} species`}</Text>
          </Box>
        </Box>
      </Box>
    )
  })
}
