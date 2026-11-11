import type { Habitat } from './fish'
import type { Outing, Save, SizeGrade } from '../types'
import { formatLength, formatWeight, GRADE_LABEL, GRADE_ODDS, sizeGrade, SPECIES, TIER_ORDER, tierName } from './fish'
import { rarest, rarestList, speciesFound, TOP_LIMIT } from './save'

// The text the /fish commands print and the recap logged when the pane closes.

const gradeSuffix = (grade: SizeGrade | null): string => (grade ? `  ${GRADE_LABEL[grade]}` : '')

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

const COMMANDS =
  'Commands: /fish, /fish dex, /fish top, /fish rare, /fish stats, /fish mute, /fish unmute, /fish sound, /fish help, /fish close'

// A /fish option that is none of the commands: say so, rather than open the game.
export const formatUnknown = (arg: string): string => `MegaBite has no "/fish ${arg}". ${COMMANDS}`

export const formatHelp = (): string =>
  [
    'MegaBite help',
    'Keys (click the pane once if they go to the chat)',
    '  Space     cast (Enter too; press again to release), set the hook, reel in',
    '  ←         let line out: when the line strains or ↯ flashes',
    '  Tab       records: Rarest, Heaviest, Water',
    '  m         mute/unmute the chime when Claude finishes while the game is open (muted by default)',
    '  Esc / q   close (Esc also from an empty chat prompt while Claude is idle; mid-turn it stops Claude)',
    'Reeling: keep ◆ in the green. Too far right snaps the line; too slack and it shakes loose.',
    'Rarity, shown by name colour: Common, Uncommon, Rare, Epic, Legendary. Longer casts find rarer fish.',
    'Where fish live: short casts reach near-shore fish, long casts deep ones; /fish dex hints where undiscovered ones are.',
    'Size tags, against catches of the same species (the same odds for every fish):',
    `  BIG        the heaviest 1 in ${GRADE_ODDS.big}`,
    `  TROPHY     the heaviest 1 in ${GRADE_ODDS.trophy}`,
    `  ★ RECORD   the heaviest 1 in ${GRADE_ODDS.record}`,
    COMMANDS,
  ].join('\n')

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
