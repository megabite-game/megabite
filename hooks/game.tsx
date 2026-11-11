import type { ClientModule } from 'claude-code'

import type { GameProps } from '../types'
import { footer, listRows, scene } from './draw'
import type { Segment } from './draw'
import { giveLine, initial, isAction, latest, nextView, press, send, tick, TICK_MS } from './play'
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
      else if (event.key === 'q') send(surface, { type: 'close' })
      else if (event.key === 'tab') nextView(surface)
      else if (event.key === 'm') send(surface, { type: 'sound' })
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
  const bottom = footer(s, props, width, isFlashing)

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
      borderColor={isFlashing ? (s.tick % 4 < 2 ? '#66bb6a' : '#b9f6ca') : bottom.accent}
      paddingX={1}
    >
      {(s.view === 'rare'
        ? listRows(props.rare, width)
        : s.view === 'heavy'
          ? listRows(props.heavy, width)
          : scene(s, props, width)
      ).map(row)}
      <Box flexDirection="row" justifyContent="space-between">
        {row(bottom.line)}
        {row([bottom.badge])}
      </Box>
    </Box>
  )
}

export default Game
