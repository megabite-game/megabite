import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { GameProps, Outing, Save } from '../types'
import {
  addCatchToOuting,
  EMPTY_OUTING,
  EMPTY_SAVE,
  formatOuting,
  formatDex,
  formatHelp,
  formatRare,
  formatStats,
  formatTop,
  formatWeight,
  GRADE_COLOR,
  GRADE_LABEL,
  heaviestList,
  landFish,
  rarest,
  rarestList,
  RARITY_COLOR,
  sizeGrade,
  recordEscape,
  rollFish,
  SPECIES,
  speciesFound,
  toSave,
} from './fish'

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

type GameMessage =
  | { type: 'bite'; distance: number }
  | { type: 'land'; id: string }
  | { type: 'lost'; id: string }
  | { type: 'close' }
  | { type: 'sound' }

const isGameMessage = (data: unknown): data is GameMessage => {
  if (typeof data !== 'object' || data === null) return false
  const type = (data as { type?: unknown }).type
  return type === 'bite' || type === 'land' || type === 'lost' || type === 'close' || type === 'sound'
}

const newId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

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

// The store is the record across sessions; re-read it before each write so two sessions don't clobber.
const loadSave = async ($: EngineInterface): Promise<Save> => {
  return toSave(await $.store.get(STORE_KEY))
}

// Flip the chime (or set it), remember it across sessions, and say what it is now.
const toggleSound = async ($: EngineInterface, to?: boolean): Promise<string> => {
  const on = to ?? !(await read($, isSoundOn))
  await update($, isSoundOn, () => on)
  await $.store.set(SOUND_KEY, on)
  return on ? 'MegaBite unmuted: a chime plays when Claude finishes.' : 'MegaBite muted.'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'fish',
      description: 'MegaBite: open the fishing pane (`/fish help` for keys and tags)',
      argumentHint: '[help|dex|top|rare|stats|mute|unmute|close]',
    })
    const stored = await loadSave($)
    await update($, save, () => stored)
    // Sound is off unless the person turned it on.
    const soundOn = (await $.store.get(SOUND_KEY)) === true
    await update($, isSoundOn, () => soundOn)

    return next(e)
  })

  on('command.run', { command: 'fish' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'close') {
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
    if (!(await read($, isOpen))) await update($, outing, () => EMPTY_OUTING)
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
    if (await read($, isOpen)) {
      await update($, claudeDoneCount, n => n + 1)
      if (await read($, isSoundOn)) $.audio.play({ asset: CHIME }).catch(() => undefined)
    }
    return done
  })

  // However the pane closes (Esc, q, the ✕, /fish close), log a one-line recap of the outing.
  on('ui.close', async ($, e, next) => {
    const closed = await next(e)
    if (e.id === PANE && (await read($, isOpen))) {
      const recap = formatOuting(await read($, outing))
      if (recap) $.ui.log(recap)
      await update($, isOpen, () => false)
      await update($, outing, () => EMPTY_OUTING)
    }
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

    if (message.type === 'bite') {
      const fish = rollFish(message.distance, Math.random, newId())
      await update($, hooked, () => fish)
    }

    if (message.type === 'land') {
      const fish = await read($, hooked)
      if (fish && fish.id === message.id) {
        const { caught, save: next, news, isNewSpecies } = landFish(await loadSave($), fish, new Date().toISOString())
        await $.store.set(STORE_KEY, next)
        await update($, save, () => next)
        await update($, last, () => caught)
        await update($, hooked, () => null)
        if (news) $.ui.toast(news)
        await update($, outing, (current: Outing) => addCatchToOuting(current, caught, isNewSpecies))
      }
    }

    if (message.type === 'lost') {
      const fish = await read($, hooked)
      if (fish && fish.id === message.id) {
        const next = recordEscape(await loadSave($))
        await $.store.set(STORE_KEY, next)
        await update($, save, () => next)
        await update($, hooked, () => null)
        await update($, outing, (current: Outing) => ({ ...current, escaped: current.escaped + 1 }))
      }
    }

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
