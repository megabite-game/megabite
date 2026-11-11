import './hooks.mjs'
// Plays one outing with the game's own code, no Claude Code needed, and keeps every frame.
const R = new URL('../../hooks/', import.meta.url).href
const { scene, footer } = await import(R + 'draw.ts')
const play = await import(R + 'play.ts')
const { rollFish, sizeGrade } = await import(R + 'fish.ts')
const { ZONE_LOW, ZONE_HIGH } = await import(R + 'reel.ts')

const W = Number(process.env.W ?? 60)
const mulberry = seed => { let x = seed >>> 0; return () => { x = (x + 0x6d2b79f5) >>> 0; let t = Math.imul(x ^ (x >>> 15), x | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

export const simulate = seed => {
  Math.random = mulberry(seed)
  const rand = mulberry(seed * 7 + 1)
  const props = { hooked: null, last: null, lastGrade: null, isClaudeBusy: true, claudeDoneCount: 0, rare: [], heavy: [] }
  let rolled = null
  const surface = {
    state: undefined,
    setState(s) { this.state = s },
    post(m) {
      if (m.type === 'bite') { rolled = rollFish(m.distance, rand, m.id); props.hooked = { id: m.id, difficulty: rolled.difficulty, rarity: rolled.rarity } }
      if (m.type === 'land' && rolled) {
        const { difficulty, ...c } = rolled
        props.last = { ...c, caughtAt: '2026-11-11T00:00:00.000Z' }; props.lastGrade = sizeGrade(c.species, c.weightLb); props.hooked = null
      }
      if (m.type === 'lost') props.hooked = null
    },
  }
  surface.setState(play.initial())
  const frames = []
  let flashUntil = -1
  const snap = () => {
    play.latest.set(surface, props)
    const s = surface.state
    const flashing = s.tick < flashUntil
    const f = footer(s, props, W, flashing)
    frames.push({ rows: scene(s, props, W), foot: f.line, badge: f.badge, accent: flashing ? (s.tick % 4 < 2 ? '#66bb6a' : '#b9f6ca') : f.accent })
  }
  const tick = () => { play.latest.set(surface, props); play.tick(surface); snap() }
  const ticks = n => { for (let i = 0; i < n; i++) tick() }

  ticks(12)
  play.press(surface); snap()
  while (!(surface.state.power >= 0.82 && surface.state.powerDir === 1)) tick()
  play.press(surface); snap()
  while (surface.state.phase === 'flying') tick()
  surface.state = { ...surface.state, biteAt: surface.state.tick + 14 }
  while (surface.state.phase === 'waiting') tick()
  ticks(3)
  play.press(surface); snap()
  let guard = 0
  while (surface.state.phase === 'reeling' && guard++ < 400) {
    const s = surface.state
    if (s.shakeWarn > 0 && !s.shakeDodged) play.giveLine(surface)
    else if (s.tension > ZONE_HIGH - 10) play.giveLine(surface)
    else if (s.tension < (ZONE_LOW + ZONE_HIGH) / 2) play.press(surface)
    tick()
  }
  const outcome = surface.state.phase
  ticks(4)
  props.isClaudeBusy = false; props.claudeDoneCount = 1; flashUntil = surface.state.tick + 30
  ticks(28)
  return { outcome, fish: props.last, grade: props.lastGrade, frames }
}

if (process.argv[2] === 'scan') {
  for (let seed = 1; seed <= 60; seed++) {
    const r = simulate(seed)
    if (r.outcome === 'landed') console.log(seed, r.frames.length, r.fish.name, r.fish.rarity, r.fish.weightLb, r.grade)
  }
}
