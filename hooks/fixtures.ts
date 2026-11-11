// Shared test data: a seeded random and a few ready-made catches.

// Deterministic stand-in for Math.random.
export const seeded = (seed: number): (() => number) => {
  let x = seed
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x / 2147483648
  }
}

// A seeded random whose draws are independent of each other (mulberry32), for tests that count outcomes
// over many rolls: in `seeded`, one draw predicts the next, which skews the tails.
export const mixed = (seed: number): (() => number) => {
  let x = seed >>> 0
  return () => {
    x = (x + 0x6d2b79f5) >>> 0
    let t = Math.imul(x ^ (x >>> 15), x | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const caughtAt = '2026-11-11T00:00:00.000Z'
export const trout = {
  id: 't1',
  species: 'golden-trout',
  name: 'Golden Trout',
  rarity: 'legendary',
  lengthIn: 11,
  weightLb: 0.7,
  caughtAt,
} as const
export const tuna = {
  id: 'b1',
  species: 'bluefin-tuna',
  name: 'Bluefin Tuna',
  rarity: 'epic',
  lengthIn: 82,
  weightLb: 430,
  caughtAt,
} as const
export const gill = {
  id: 'g1',
  species: 'bluegill',
  name: 'Bluegill',
  rarity: 'common',
  lengthIn: 7,
  weightLb: 0.3,
  caughtAt,
} as const
