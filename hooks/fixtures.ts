// Shared test data: a seeded random and a few ready-made catches.

// Deterministic stand-in for Math.random.
export const seeded = (seed: number): (() => number) => {
  let x = seed
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x / 2147483648
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
  isTrophy: false,
  caughtAt,
} as const
export const tuna = {
  id: 'b1',
  species: 'bluefin-tuna',
  name: 'Bluefin Tuna',
  rarity: 'epic',
  lengthIn: 82,
  weightLb: 430,
  isTrophy: false,
  caughtAt,
} as const
export const gill = {
  id: 'g1',
  species: 'bluegill',
  name: 'Bluegill',
  rarity: 'common',
  lengthIn: 7,
  weightLb: 0.3,
  isTrophy: false,
  caughtAt,
} as const
