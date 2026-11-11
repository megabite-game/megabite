import type { Catch, Hooked, Outing, RareEntry, Rarity, Save, SizeGrade } from '../types'

// Where a fish is found: near the dock, anywhere, or out deep. Short casts favour shore fish, long casts deep ones.
type Habitat = 'shore' | 'any' | 'deep'

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

const TROPHY_CHANCE = 0.04

export type Random = () => number

// Standard normal from two uniforms (Box-Muller).
const gaussian = (random: Random): number => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())

const round = (value: number, places: number): number => {
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
  for (let i = 0; i < SPECIES.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return SPECIES[i]
  }
  return SPECIES[SPECIES.length - 1]
}

// Length is log-normal around the typical size; weight follows W = a * L^3 with a little body-condition noise.
export const rollFish = (distance: number, random: Random, id: string): Hooked => {
  const species = pickSpecies(distance, random)
  const isTrophy = random() < TROPHY_CHANCE
  let length = species.lengthIn * Math.exp(0.18 * gaussian(random))
  if (isTrophy) length *= 1.3 + random() * 0.4
  length = Math.min(species.maxLengthIn, Math.max(species.lengthIn * 0.4, length))
  const a = species.weightLb / species.lengthIn ** 3
  const condition = 0.88 + random() * 0.24
  const weight = a * length ** 3 * condition
  const sizeFactor = Math.min(1, length / species.maxLengthIn)

  return {
    id,
    species: species.id,
    name: species.name,
    rarity: species.rarity,
    lengthIn: round(length, 1),
    weightLb: round(weight, weight < 1 ? 3 : 2),
    isTrophy,
    difficulty: round(Math.min(1, species.fight * 0.8 + sizeFactor * 0.3), 2),
  }
}

// Graded against the species, as state trophy programs do: 1.3× typical weight is big,
// 2× is a trophy, and 80% of the heaviest the species can roll is record class.
export const sizeGrade = (speciesId: string, weightLb: number): SizeGrade | null => {
  const species = SPECIES.find(one => one.id === speciesId)
  if (!species) return null
  const heaviest = species.weightLb * (species.maxLengthIn / species.lengthIn) ** 3
  if (weightLb >= heaviest * 0.8) return 'record'
  if (weightLb >= species.weightLb * 2) return 'trophy'
  if (weightLb >= species.weightLb * 1.3) return 'big'
  return null
}

export const GRADE_LABEL: Record<SizeGrade, string> = { big: 'BIG', trophy: 'TROPHY', record: '★ RECORD' }
export const GRADE_COLOR: Record<SizeGrade, string> = { big: '#ff8a65', trophy: '#ff5722', record: '#ff1744' }

const gradeSuffix = (grade: SizeGrade | null): string => (grade ? `  ${GRADE_LABEL[grade]}` : '')

export const EMPTY_SAVE: Save = {
  version: 1,
  totalCaught: 0,
  totalEscaped: 0,
  totalWeightLb: 0,
  species: {},
  biggest: null,
  recent: [],
  top: [],
  seenGrades: [],
}

const RECENT_LIMIT = 100
const TOP_LIMIT = 10
const TIER_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

const byWeight = (a: Catch, b: Catch): number => b.weightLb - a.weightLb

const isKnown = (fish: Catch): boolean => SPECIES.some(one => one.id === fish.species)

// Accept a stored save, filling fields an earlier version did not keep and dropping
// catches of species no longer in the game (the old joke fish).
export const toSave = (value: unknown): Save => {
  if (typeof value !== 'object' || value === null || (value as { version?: unknown }).version !== 1) return EMPTY_SAVE
  const stored = value as Partial<Save>
  const recent = (stored.recent ?? []).filter(isKnown)
  // Rebuild the top list from both lists so a dropped entry is refilled from recent catches.
  const pool = new Map([...(stored.top ?? []), ...recent].filter(isKnown).map(one => [one.id, one]))
  const top = [...pool.values()].sort(byWeight).slice(0, TOP_LIMIT)
  const species = Object.fromEntries(
    Object.entries(stored.species ?? {}).filter(([id]) => SPECIES.some(one => one.id === id)),
  )
  const biggest = stored.biggest && isKnown(stored.biggest) ? stored.biggest : (top[0] ?? null)
  // Counts follow the species kept; weight is trimmed by what the dropped recent catches weighed.
  const totalCaught = Object.values(species).reduce((sum, one) => sum + one.count, 0)
  const droppedWeight = (stored.recent ?? []).filter(one => !isKnown(one)).reduce((sum, one) => sum + one.weightLb, 0)
  const totalWeightLb = round(Math.max(0, (stored.totalWeightLb ?? 0) - droppedWeight), 2)
  return {
    ...EMPTY_SAVE,
    ...stored,
    recent,
    top,
    species,
    biggest,
    totalCaught,
    totalWeightLb,
    seenGrades: stored.seenGrades ?? [],
  }
}

export const recordCatch = (save: Save, fish: Catch): Save => {
  const prior = save.species[fish.species] ?? { count: 0, bestWeightLb: 0, bestLengthIn: 0 }
  const isBiggest = save.biggest === null || fish.weightLb > save.biggest.weightLb

  return {
    ...save,
    totalCaught: save.totalCaught + 1,
    totalWeightLb: round(save.totalWeightLb + fish.weightLb, 2),
    species: {
      ...save.species,
      [fish.species]: {
        count: prior.count + 1,
        bestWeightLb: Math.max(prior.bestWeightLb, fish.weightLb),
        bestLengthIn: Math.max(prior.bestLengthIn, fish.lengthIn),
      },
    },
    biggest: isBiggest ? fish : save.biggest,
    recent: [fish, ...save.recent].slice(0, RECENT_LIMIT),
    top: [...save.top, fish].sort(byWeight).slice(0, TOP_LIMIT),
  }
}

export const recordEscape = (save: Save): Save => ({ ...save, totalEscaped: save.totalEscaped + 1 })

// One format everywhere, pane and commands alike: one decimal.
export const formatWeight = (lb: number): string => (lb < 1 ? `${(lb * 16).toFixed(1)} oz` : `${lb.toFixed(1)} lb`)
export const formatLength = (inches: number): string => `${inches.toFixed(1)} in`

const tierName = (rarity: Rarity): string => rarity[0].toUpperCase() + rarity.slice(1)

// What a catch earned, biggest news first; empty when it was nothing new.
export const catchNews = (before: Save, fish: Catch): string | null => {
  const prior = before.species[fish.species]
  if (before.biggest === null || fish.weightLb > before.biggest.weightLb)
    return `MegaBite record: ${fish.name}, ${formatWeight(fish.weightLb)}!`
  if (!prior) return `New species: ${fish.name} (${tierName(fish.rarity)})`
  if (fish.weightLb > prior.bestWeightLb) return `Personal best: ${fish.name}, ${formatWeight(fish.weightLb)}`
  return null
}

// The rarest species caught; within a tier, the one with the heaviest best.
export const rarest = (save: Save): { name: string; rarity: Rarity } | null => {
  let found: { name: string; rarity: Rarity; weight: number } | null = null
  for (const one of SPECIES) {
    const best = save.species[one.id]
    if (!best) continue
    const rank = TIER_ORDER.indexOf(one.rarity)
    const current = found ? TIER_ORDER.indexOf(found.rarity) : -1
    if (!found || rank > current || (rank === current && best.bestWeightLb > found.weight)) {
      found = { name: one.name, rarity: one.rarity, weight: best.bestWeightLb }
    }
  }
  return found && { name: found.name, rarity: found.rarity }
}

export const speciesFound = (save: Save): number => SPECIES.filter(one => save.species[one.id]).length

const HABITAT_WORD: Record<Habitat, string> = { shore: 'near shore', any: 'anywhere', deep: 'deep' }

const NAME_WIDTH = Math.max(...SPECIES.map(one => one.name.length)) + 2

export const formatDex = (save: Save): string => {
  const lines = [`MegaBite dex: ${speciesFound(save)}/${SPECIES.length} species`]
  for (const tier of TIER_ORDER) {
    const inTier = SPECIES.filter(one => one.rarity === tier)
    lines.push(`${tierName(tier)} ${inTier.filter(one => save.species[one.id]).length}/${inTier.length}`)
    for (const one of inTier) {
      const best = save.species[one.id]
      if (best) {
        lines.push(
          `  ${one.name.padEnd(NAME_WIDTH)}${formatWeight(best.bestWeightLb).padStart(10)}${formatLength(best.bestLengthIn).padStart(9)}   ${best.count} caught`,
        )
      }
    }
    // Names stay hidden; where they live is the hint (short casts find shore fish, long casts deep ones).
    const missing = inTier.filter(one => !save.species[one.id])
    if (missing.length > 0) {
      const where = (['shore', 'any', 'deep'] as const)
        .map(habitat => [missing.filter(one => one.habitat === habitat).length, HABITAT_WORD[habitat]] as const)
        .filter(([count]) => count > 0)
        .map(([count, word]) => `${count} ${word}`)
        .join(', ')
      lines.push(`  +${missing.length} undiscovered: ${where}`)
    }
  }
  return lines.join('\n').trimEnd()
}

export const formatTop = (save: Save): string => {
  if (save.top.length === 0) return 'MegaBite heaviest catches: nothing landed yet.'
  return [
    `MegaBite heaviest catches${save.top.length === TOP_LIMIT ? ` (top ${TOP_LIMIT})` : ''}`,
    ...save.top.map(
      (one, i) =>
        `${String(i + 1).padStart(3)}. ${one.name.padEnd(NAME_WIDTH)}${formatWeight(one.weightLb).padStart(10)}${formatLength(one.lengthIn).padStart(9)}  ${tierName(one.rarity)}`,
    ),
  ].join('\n')
}

export const formatStats = (save: Save): string => {
  const rare = rarest(save)
  return [
    `Caught ${save.totalCaught} (${save.totalEscaped} got away), ${formatWeight(save.totalWeightLb)} in all.`,
    save.biggest
      ? `Heaviest: ${save.biggest.name}, ${formatWeight(save.biggest.weightLb)}, ${formatLength(save.biggest.lengthIn)}.`
      : 'Heaviest: none yet.',
    rare ? `Rarest: ${rare.name} (${tierName(rare.rarity)}).` : 'Rarest: none yet.',
    `Species: ${speciesFound(save)}/${SPECIES.length}. More: /fish dex, /fish top, /fish rare, /fish help.`,
  ].join('\n')
}

// Caught species, rarest tier first and heaviest best first within a tier.
export const rarestList = (save: Save, limit: number): RareEntry[] =>
  SPECIES.filter(one => save.species[one.id])
    .map(one => {
      const best = save.species[one.id]
      return {
        name: one.name,
        rarity: one.rarity,
        weightLb: best.bestWeightLb,
        lengthIn: best.bestLengthIn,
        count: best.count,
        grade: sizeGrade(one.id, best.bestWeightLb),
      }
    })
    .sort((a, b) => TIER_ORDER.indexOf(b.rarity) - TIER_ORDER.indexOf(a.rarity) || b.weightLb - a.weightLb)
    .slice(0, limit)

export const formatRare = (save: Save): string => {
  const list = rarestList(save, 10)
  if (list.length === 0) return 'MegaBite rarest: nothing landed yet.'
  return [
    'MegaBite rarest catches (your best of each species)',
    ...list.map(one =>
      `  ${tierName(one.rarity).padEnd(10)}${one.name.padEnd(NAME_WIDTH)}${formatWeight(one.weightLb).padStart(10)}${formatLength(one.lengthIn).padStart(9)}   ${`${one.count} caught`.padEnd(9)}${gradeSuffix(one.grade)}`.trimEnd(),
    ),
  ].join('\n')
}

// The heaviest single catches, as list rows for the pane. Weight only: a size tag here would contradict the order.
export const heaviestList = (save: Save, limit: number): RareEntry[] =>
  save.top.slice(0, limit).map(one => ({
    name: one.name,
    rarity: one.rarity,
    weightLb: one.weightLb,
    lengthIn: one.lengthIn,
    count: 1,
    grade: null,
  }))

// The first time a size tag is earned, say what it means; never again after.
export const gradeIntro = (save: Save, fish: Catch): { text: string; grade: SizeGrade } | null => {
  const grade = sizeGrade(fish.species, fish.weightLb)
  if (!grade || save.seenGrades.includes(grade)) return null
  const meaning =
    grade === 'record'
      ? `close to the heaviest ${fish.name} there is`
      : `at least ${grade === 'trophy' ? '2' : '1.3'}× a typical ${fish.name}'s weight`
  return { grade, text: `First ${GRADE_LABEL[grade]}: ${meaning}` }
}

export const formatHelp = (): string =>
  [
    'MegaBite help',
    'Keys (click the pane once if they go to the chat)',
    '  Space     cast, set the hook, reel in',
    '  ←         let line out: when the line strains or ↯ flashes',
    '  Tab       records: Rarest, Heaviest, Water',
    '  m         mute/unmute the chime when Claude finishes while the game is open (muted by default)',
    '  Esc       close (works from the chat too; q also works inside the game)',
    'Reeling: keep ◆ in the green. Too far right snaps the line; too slack and it shakes loose.',
    'Rarity, shown by name colour: Common, Uncommon, Rare, Epic, Legendary. Longer casts find rarer fish.',
    'Where fish live: short casts reach near-shore fish, long casts deep ones; /fish dex hints where undiscovered ones are.',
    "Size tags, against that species' typical weight:",
    '  BIG        1.3× typical or more',
    '  TROPHY     2× typical or more',
    '  ★ RECORD   near the heaviest that species gets',
    'Commands: /fish dex, /fish top, /fish rare, /fish stats, /fish mute, /fish unmute, /fish help, /fish close',
  ].join('\n')

export const EMPTY_OUTING: Outing = { caught: 0, escaped: 0, newSpecies: 0, best: null }

export const addCatchToOuting = (outing: Outing, fish: Catch, isNewSpecies: boolean): Outing => ({
  ...outing,
  caught: outing.caught + 1,
  newSpecies: outing.newSpecies + (isNewSpecies ? 1 : 0),
  best: outing.best === null || fish.weightLb > outing.best.weightLb ? fish : outing.best,
})

// One line for the transcript when the pane closes; null when nothing happened.
export const formatOuting = (outing: Outing): string | null => {
  if (outing.caught === 0 && outing.escaped === 0) return null
  const parts = [`${outing.caught} caught`]
  if (outing.newSpecies > 0) parts.push(`${outing.newSpecies} new species`)
  if (outing.escaped > 0) parts.push(`${outing.escaped} got away`)
  if (outing.best) {
    const grade = sizeGrade(outing.best.species, outing.best.weightLb)
    parts.push(`best ${grade ? `${GRADE_LABEL[grade]} ` : ''}${outing.best.name} ${formatWeight(outing.best.weightLb)}`)
  }
  return `MegaBite recap: ${parts.join(' · ')}`
}

// Everything a landed fish changes in the save, plus the one pop-up it earns: the news,
// then a size tag's meaning the first time that tag is earned.
export const landFish = (
  before: Save,
  fish: Hooked,
  caughtAt: string,
): { caught: Catch; save: Save; news: string; isNewSpecies: boolean } => {
  const caught: Catch = {
    id: fish.id,
    species: fish.species,
    name: fish.name,
    rarity: fish.rarity,
    lengthIn: fish.lengthIn,
    weightLb: fish.weightLb,
    isTrophy: fish.isTrophy,
    caughtAt,
  }
  const intro = gradeIntro(before, caught)
  const caughtSave = recordCatch(before, caught)
  const save = intro ? { ...caughtSave, seenGrades: [...caughtSave.seenGrades, intro.grade] } : caughtSave
  const news = [catchNews(before, caught), intro?.text].filter(Boolean).join(' · ')
  return { caught, save, news, isNewSpecies: !before.species[caught.species] }
}
