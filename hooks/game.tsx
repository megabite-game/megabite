import type { ClientModule } from 'claude-code'

import type { GameProps } from '../types'
import { hud, listRows, scene, tabBar, VIEW_TAB } from './draw'
import type { Hud, Segment } from './draw'
import { giveLine, initial, isAction, latest, nextView, press, tick, TICK_MS } from './play'
import type { State } from './play'

// The Claude-done count each game last saw, and the tick its flash ends.
const doneSeen = new WeakMap<object, { count: number; flashUntil: number }>()

const Game: ClientModule<GameProps, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  latest.set(surface, props)

  if (surface.state === undefined) {
    surface.every(TICK_MS, () => tick(surface))
    surface.onKey(event => {
      if (isAction(event.key)) press(surface)
      else if (event.key === 'left') giveLine(surface)
      else if (event.key === 'q') surface.post({ type: 'close' })
      else if (event.key === 'tab') nextView(surface)
      else if (event.key === 'm') surface.post({ type: 'sound' })
    })
    surface.setState(initial())
    return <Text dimColor>…</Text>
  }

  const s = surface.state
  const width = Math.max(24, Math.min(80, (surface.columns || 44) - 4))
  // A new Claude-done count starts a 3-second flash; the first one seen is just a baseline.
  const seen = doneSeen.get(surface)
  if (!seen) doneSeen.set(surface, { count: props.claudeDoneCount, flashUntil: 0 })
  else if (props.claudeDoneCount !== seen.count)
    doneSeen.set(surface, { count: props.claudeDoneCount, flashUntil: s.tick + 30 })
  const isFlashing = (doneSeen.get(surface)?.flashUntil ?? 0) > s.tick
  const panel: Hud = s.view === 'fish' ? hud(s, props, width) : { accent: VIEW_TAB[s.view].color, line: tabBar(s.view) }

  const row = (line: Segment[]) => (
    <Box flexDirection="row">
      {line.map(seg => (
        <Text color={seg.color} backgroundColor={seg.bg} weight={seg.bold ? 'bold' : undefined}>
          {seg.text}
        </Text>
      ))}
    </Box>
  )

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFlashing ? (s.tick % 4 < 2 ? '#66bb6a' : '#b9f6ca') : panel.accent}
      paddingX={1}
    >
      {(s.view === 'rare'
        ? listRows(props.rare, width)
        : s.view === 'heavy'
          ? listRows(props.heavy, width)
          : scene(s, props, width)
      ).map(row)}
      <Box flexDirection="row" justifyContent="space-between">
        {row(panel.line)}
        {props.isClaudeBusy ? (
          <Text color="#ffca28">◌</Text>
        ) : isFlashing ? (
          <Text color="#ffffff" backgroundColor="#2e7d32" weight="bold">
            {' ✓ Claude done '}
          </Text>
        ) : (
          <Text color="#66bb6a">✓</Text>
        )}
      </Box>
    </Box>
  )
}

export default Game
