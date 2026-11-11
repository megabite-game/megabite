import type { Hooked, Rarity, SizeGrade } from '../types'

// The 50 species: picking and rolling a fish at the bite, size grades, and how weights and lengths read.

// Where a fish is found: near the dock, anywhere, or out deep. Short casts favour shore fish, long casts deep ones.
export type Habitat = 'shore' | 'any' | 'deep'

type Species = {
  id: string
  name: string
  rarity: Rarity
  habitat: Habitat
  // Typical adult length and the weight at that length; caps checked against IGFA and FishBase records.
  lengthIn: number
  weightLb: number
  // Cap near the real record so a lucky roll stays believable.
  maxLengthIn: number
  fight: number
}

const fish = (
  name: string,
  rarity: Rarity,
  habitat: Habitat,
  lengthIn: number,
  weightLb: number,
  maxLengthIn: number,
  fight: number,
): Species => ({
  id: name.toLowerCase().replace(/[^a-z]+/g, '-'),
  name,
  rarity,
  habitat,
  lengthIn,
  weightLb,
  maxLengthIn,
  fight,
})

// Rarity follows how often an angler meets the fish in real life.
export const SPECIES: readonly Species[] = [
  // Common: everyday catches from docks, ponds and piers.
  fish('Bluegill', 'common', 'shore', 7, 0.3, 15, 0.1),
  fish('Pumpkinseed', 'common', 'shore', 6, 0.2, 12, 0.1),
  fish('Yellow Perch', 'common', 'any', 9, 0.3, 18, 0.15),
  fish('Black Crappie', 'common', 'any', 10, 0.6, 19, 0.15),
  fish('Rock Bass', 'common', 'shore', 8, 0.4, 15, 0.15),
  fish('Creek Chub', 'common', 'shore', 6, 0.1, 12, 0.05),
  fish('Golden Shiner', 'common', 'shore', 6, 0.1, 12, 0.05),
  fish('Brown Bullhead', 'common', 'any', 11, 0.6, 21, 0.2),
  fish('Channel Catfish', 'common', 'any', 20, 3, 52, 0.35),
  fish('Common Carp', 'common', 'any', 22, 5, 48, 0.4),
  fish('Largemouth Bass', 'common', 'shore', 15, 1.8, 32, 0.35),
  fish('Smallmouth Bass', 'common', 'any', 13, 1, 27, 0.4),
  fish('Rainbow Trout', 'common', 'any', 14, 1.2, 40, 0.35),
  fish('White Sucker', 'common', 'any', 15, 1.5, 25, 0.15),
  fish('Atlantic Mackerel', 'common', 'deep', 12, 0.8, 18, 0.3),
  // Uncommon: targeted sport fish.
  fish('Walleye', 'uncommon', 'any', 18, 2, 38, 0.35),
  fish('Northern Pike', 'uncommon', 'any', 24, 4, 58, 0.5),
  fish('Brown Trout', 'uncommon', 'any', 16, 1.8, 44, 0.4),
  fish('Brook Trout', 'uncommon', 'shore', 10, 0.5, 25, 0.3),
  fish('Striped Bass', 'uncommon', 'deep', 24, 7, 54, 0.5),
  fish('Red Drum', 'uncommon', 'any', 24, 6, 60, 0.5),
  fish('Summer Flounder', 'uncommon', 'any', 16, 1.6, 37, 0.25),
  fish('Common Snook', 'uncommon', 'shore', 24, 5, 48, 0.55),
  fish('Spotted Seatrout', 'uncommon', 'any', 16, 1.5, 36, 0.3),
  fish('Lake Trout', 'uncommon', 'deep', 24, 5, 50, 0.4),
  fish('Bowfin', 'uncommon', 'shore', 20, 3, 38, 0.5),
  fish('Longnose Gar', 'uncommon', 'shore', 30, 4, 72, 0.45),
  fish('Mahi-mahi', 'uncommon', 'deep', 30, 8, 66, 0.6),
  // Rare: trophy fish people travel for.
  fish('Muskellunge', 'rare', 'any', 40, 18, 60, 0.75),
  fish('Tarpon', 'rare', 'deep', 50, 50, 90, 0.8),
  fish('Atlantic Salmon', 'rare', 'any', 28, 9, 59, 0.65),
  fish('Chinook Salmon', 'rare', 'deep', 33, 18, 58, 0.7),
  fish('Steelhead', 'rare', 'any', 28, 8, 45, 0.65),
  fish('Lake Sturgeon', 'rare', 'deep', 45, 25, 85, 0.6),
  fish('Pacific Halibut', 'rare', 'deep', 40, 30, 100, 0.6),
  fish('Yellowfin Tuna', 'rare', 'deep', 45, 60, 85, 0.8),
  fish('Wahoo', 'rare', 'deep', 50, 35, 85, 0.75),
  fish('Alligator Gar', 'rare', 'any', 60, 55, 101, 0.7),
  // Epic: once-in-a-career giants.
  fish('Swordfish', 'epic', 'deep', 90, 175, 168, 0.9),
  fish('Bluefin Tuna', 'epic', 'deep', 80, 400, 125, 0.95),
  fish('Blue Marlin', 'epic', 'deep', 110, 300, 180, 0.95),
  fish('Sailfish', 'epic', 'deep', 85, 60, 132, 0.85),
  fish('Arapaima', 'epic', 'any', 80, 200, 102, 0.85),
  fish('Goliath Grouper', 'epic', 'deep', 60, 180, 98, 0.8),
  fish('White Sturgeon', 'epic', 'deep', 72, 100, 120, 0.8),
  fish('Giant Trevally', 'epic', 'deep', 30, 20, 60, 0.85),
  // Legendary: barely seen alive, or found in one tiny range.
  fish('Coelacanth', 'legendary', 'deep', 60, 100, 79, 0.9),
  fish('Golden Trout', 'legendary', 'shore', 10, 0.5, 18, 0.6),
  fish('Mekong Giant Catfish', 'legendary', 'any', 80, 280, 106, 1),
  fish('Giant Oarfish', 'legendary', 'deep', 120, 100, 200, 0.9),
]

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#eceff1',
  uncommon: '#66bb6a',
  rare: '#42a5f5',
  epic: '#ba68c8',
  legendary: '#ffca28',
}

// Share of catches per tier at a mid-length cast.
const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 50,
  uncommon: 28,
  rare: 14,
  epic: 6,
  legendary: 2,
}

// Spread of lengths around the typical one (log-normal sigma).
const LENGTH_SIGMA = 0.18
// Now and then a fish runs well past typical length (1.3 to 1.7×); its size tag still comes from its weight.
const BONUS_SIZE_CHANCE = 0.04
const BONUS_LOW = 1.3
const BONUS_SPAN = 0.4
// Body condition: weight for length varies ±12%.
const CONDITION_LOW = 0.88
const CONDITION_SPAN = 0.24

export type Random = () => number

// Standard normal from two uniforms (Box-Muller).
const gaussian = (random: Random): number => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())

export const round = (value: number, places: number): number => {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

const HABITAT_PULL: Record<Habitat, (reach: number) => number> = {
  shore: reach => 1.6 - reach * 1.2,
  any: () => 1,
  deep: reach => 0.4 + reach * 1.2,
}

// Cast length picks the water: short favours shore fish, long favours deep ones and rarer tiers.
export const pickSpecies = (distance: number, random: Random): Species => {
  const reach = Math.min(1, Math.max(0, distance))
  const weights = SPECIES.map(one => {
    const base = RARITY_WEIGHT[one.rarity] / SPECIES.filter(s => s.rarity === one.rarity).length
    const rarer = one.rarity === 'common' ? 1 : 1 + reach * 0.6
    return base * rarer * HABITAT_PULL[one.habitat](reach)
  })
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = random() * total
  for (const [i, one] of SPECIES.entries()) {
    roll -= weights[i] ?? 0
    if (roll <= 0) return one
  }
  // Float rounding can leave a sliver of the roll; the last species takes it. SPECIES is never empty.
  return SPECIES[SPECIES.length - 1]!
}

// Length is log-normal around the typical size; weight follows W = a * L^3 with a little body-condition noise.
export const rollFish = (distance: number, random: Random, id: string): Hooked => {
  const species = pickSpecies(distance, random)
  const isBonusSize = random() < BONUS_SIZE_CHANCE
  let length = species.lengthIn * Math.exp(LENGTH_SIGMA * gaussian(random))
  if (isBonusSize) length *= BONUS_LOW + random() * BONUS_SPAN
  length = Math.min(species.maxLengthIn, Math.max(species.lengthIn * 0.4, length))
  const a = species.weightLb / species.lengthIn ** 3
  const condition = CONDITION_LOW + random() * CONDITION_SPAN
  const weight = a * length ** 3 * condition
  const sizeFactor = Math.min(1, length / species.maxLengthIn)

  return {
    id,
    species: species.id,
    name: species.name,
    rarity: species.rarity,
    lengthIn: round(length, 1),
    weightLb: round(weight, weight < 1 ? 3 : 2),
    difficulty: round(Math.min(1, species.fight * 0.8 + sizeFactor * 0.3), 2),
  }
}

// Each size tag goes to the heaviest 1 in N catches of a species, the same odds for every species.
export const GRADE_ODDS: Record<SizeGrade, number> = { big: 10, trophy: 30, record: 60 }

// Upper tail of the standard normal (Abramowitz & Stegun 7.1.26, error under 1.5e-7).
const normalTail = (z: number): number => {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const erfc =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x)
  return z >= 0 ? erfc / 2 : 1 - erfc / 2
}

// The share of rollFish's catches of a species weighing at least `weight`, by its own odds: length, the
// bonus stretch, the cap and body condition (the floor on length only lifts small fish, so it is left out).
const MIDPOINTS = 24
const shareAtLeast = (species: Species, weight: number): number => {
  const a = species.weightLb / species.lengthIn ** 3
  const longerThan = (length: number, stretch: number): number =>
    normalTail(Math.log(length / (species.lengthIn * stretch)) / LENGTH_SIGMA)
  let sum = 0
  for (let i = 0; i < MIDPOINTS; i++) {
    const condition = CONDITION_LOW + (CONDITION_SPAN * (i + 0.5)) / MIDPOINTS
    const length = Math.cbrt(weight / (a * condition))
    // Lengths stop at the cap, so a weight that needs more is never reached in this condition.
    if (length > species.maxLengthIn) continue
    let bonus = 0
    for (let j = 0; j < MIDPOINTS; j++) bonus += longerThan(length, BONUS_LOW + (BONUS_SPAN * (j + 0.5)) / MIDPOINTS)
    sum += (1 - BONUS_SIZE_CHANCE) * longerThan(length, 1) + (BONUS_SIZE_CHANCE * bonus) / MIDPOINTS
  }
  return sum / MIDPOINTS
}

// The weight only `share` of a species' catches reach, found by bisection; worked out once per tag and species.
const lineCache = new Map<string, number>()
const weightForShare = (species: Species, share: number): number => {
  const key = `${species.id}:${share}`
  const known = lineCache.get(key)
  if (known !== undefined) return known
  let low = species.weightLb
  let high = (species.weightLb / species.lengthIn ** 3) * species.maxLengthIn ** 3 * (CONDITION_LOW + CONDITION_SPAN)
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2
    if (shareAtLeast(species, mid) > share) low = mid
    else high = mid
  }
  lineCache.set(key, high)
  return high
}

// The weights where a species' size tags start: the heaviest 1 in 10 of its catches are big, 1 in 30 a
// trophy, 1 in 60 record class (GRADE_ODDS), whether the species' cap sits near its typical size or far.
export const gradeLines = (
  speciesId: string,
): { typical: number; big: number; trophy: number; record: number } | null => {
  const species = SPECIES.find(one => one.id === speciesId)
  if (!species) return null
  const at = (grade: SizeGrade): number => weightForShare(species, 1 / GRADE_ODDS[grade])
  return { typical: species.weightLb, big: at('big'), trophy: at('trophy'), record: at('record') }
}

export const sizeGrade = (speciesId: string, weightLb: number): SizeGrade | null => {
  const lines = gradeLines(speciesId)
  if (!lines) return null
  if (weightLb >= lines.record) return 'record'
  if (weightLb >= lines.trophy) return 'trophy'
  if (weightLb >= lines.big) return 'big'
  return null
}

export const GRADE_LABEL: Record<SizeGrade, string> = { big: 'BIG', trophy: 'TROPHY', record: '★ RECORD' }
export const GRADE_COLOR: Record<SizeGrade, string> = { big: '#ff8a65', trophy: '#ff5722', record: '#ff1744' }

export const TIER_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

// One format everywhere, pane and commands alike: one decimal.
export const formatWeight = (lb: number): string => (lb < 1 ? `${(lb * 16).toFixed(1)} oz` : `${lb.toFixed(1)} lb`)
export const formatLength = (inches: number): string => `${inches.toFixed(1)} in`

export const tierName = (rarity: Rarity): string => rarity.charAt(0).toUpperCase() + rarity.slice(1)
