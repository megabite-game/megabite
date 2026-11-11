import type { Catch, Hooked, Outing, RareEntry, Rarity, Save, SizeGrade, SpeciesRecord } from '../types'
import { formatWeight, GRADE_LABEL, round, sizeGrade, SPECIES, TIER_ORDER, tierName } from './fish'

// The catch log kept across sessions: recording catches and escapes, reading old saves, and the lists built from it.

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
export const TOP_LIMIT = 10

const byWeight = (a: Catch, b: Catch): number => b.weightLb - a.weightLb

const GRADES: readonly SizeGrade[] = ['big', 'trophy', 'record']

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

// A stored catch the game can still show: the fields it reads, of a species still in the game.
const isCatch = (value: unknown): value is Catch => {
  if (typeof value !== 'object' || value === null) return false
  const one = value as Partial<Catch>
  return (
    typeof one.id === 'string' &&
    typeof one.name === 'string' &&
    typeof one.rarity === 'string' &&
    isCount(one.weightLb) &&
    isCount(one.lengthIn) &&
    SPECIES.some(known => known.id === one.species)
  )
}

const isRecord = (value: unknown): value is SpeciesRecord =>
  typeof value === 'object' &&
  value !== null &&
  isCount((value as SpeciesRecord).count) &&
  isCount((value as SpeciesRecord).bestWeightLb) &&
  isCount((value as SpeciesRecord).bestLengthIn)

// Accept a stored save, filling fields an earlier version did not keep and dropping catches of species
// no longer in the game (the old joke fish) or entries too damaged to read.
export const toSave = (value: unknown): Save => {
  if (typeof value !== 'object' || value === null || (value as { version?: unknown }).version !== 1) return EMPTY_SAVE
  const stored = value as Record<keyof Save, unknown>
  const storedRecent: unknown[] = Array.isArray(stored.recent) ? stored.recent : []
  const recent = storedRecent.filter(isCatch)
  // Rebuild the top list from both lists so a dropped entry is refilled from recent catches.
  const storedTop: unknown[] = Array.isArray(stored.top) ? stored.top : []
  const pool = new Map([...storedTop, ...recent].filter(isCatch).map(one => [one.id, one]))
  const top = [...pool.values()].sort(byWeight).slice(0, TOP_LIMIT)
  const storedSpecies = typeof stored.species === 'object' && stored.species !== null ? stored.species : {}
  const species = Object.fromEntries(
    Object.entries(storedSpecies).filter(
      (entry): entry is [string, SpeciesRecord] => SPECIES.some(one => one.id === entry[0]) && isRecord(entry[1]),
    ),
  )
  const biggest = isCatch(stored.biggest) ? stored.biggest : (top[0] ?? null)
  // Counts follow the species kept; weight is trimmed by what the dropped recent catches weighed.
  const totalCaught = Object.values(species).reduce((sum, one) => sum + one.count, 0)
  const droppedWeight = storedRecent
    .filter(one => !isCatch(one))
    .reduce((sum: number, one) => sum + (Number((one as { weightLb?: unknown } | null)?.weightLb) || 0), 0)
  const totalWeightLb = round(
    Math.max(0, (isCount(stored.totalWeightLb) ? stored.totalWeightLb : 0) - droppedWeight),
    2,
  )
  const seenGrades = Array.isArray(stored.seenGrades)
    ? GRADES.filter(grade => (stored.seenGrades as unknown[]).includes(grade))
    : []
  return {
    version: 1,
    totalCaught,
    totalEscaped: isCount(stored.totalEscaped) ? stored.totalEscaped : 0,
    totalWeightLb,
    species,
    biggest,
    recent,
    top,
    seenGrades,
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

// Caught species, rarest tier first and heaviest best first within a tier.
export const rarestList = (save: Save, limit: number): RareEntry[] =>
  SPECIES.flatMap(one => {
    const best = save.species[one.id]
    if (!best) return []
    return [
      {
        name: one.name,
        rarity: one.rarity,
        weightLb: best.bestWeightLb,
        lengthIn: best.bestLengthIn,
        count: best.count,
        grade: sizeGrade(one.id, best.bestWeightLb),
      },
    ]
  })
    .sort((a, b) => TIER_ORDER.indexOf(b.rarity) - TIER_ORDER.indexOf(a.rarity) || b.weightLb - a.weightLb)
    .slice(0, limit)

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

export const EMPTY_OUTING: Outing = { caught: 0, escaped: 0, newSpecies: 0, best: null }

export const addCatchToOuting = (outing: Outing, fish: Catch, isNewSpecies: boolean): Outing => ({
  ...outing,
  caught: outing.caught + 1,
  newSpecies: outing.newSpecies + (isNewSpecies ? 1 : 0),
  best: outing.best === null || fish.weightLb > outing.best.weightLb ? fish : outing.best,
})

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
    caughtAt,
  }
  const intro = gradeIntro(before, caught)
  const caughtSave = recordCatch(before, caught)
  const save = intro ? { ...caughtSave, seenGrades: [...caughtSave.seenGrades, intro.grade] } : caughtSave
  const news = [catchNews(before, caught), intro?.text].filter(Boolean).join(' · ')
  return { caught, save, news, isNewSpecies: !before.species[caught.species] }
}
