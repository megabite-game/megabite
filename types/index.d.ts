export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

// How big a catch is for its own species; average and small fish have none.
export type SizeGrade = 'big' | 'trophy' | 'record'

// A fish on the line: rolled by the hooks module at the bite, revealed on landing.
export type Hooked = {
  id: string
  species: string
  name: string
  rarity: Rarity
  lengthIn: number
  weightLb: number
  isTrophy: boolean
  // 0 (easy) to 1 (fights hard); the only thing the game shows before landing.
  difficulty: number
}

export type Catch = {
  id: string
  species: string
  name: string
  rarity: Rarity
  lengthIn: number
  weightLb: number
  isTrophy: boolean
  caughtAt: string
}

export type SpeciesRecord = {
  count: number
  bestWeightLb: number
  bestLengthIn: number
}

export type Save = {
  version: 1
  totalCaught: number
  totalEscaped: number
  totalWeightLb: number
  species: Record<string, SpeciesRecord>
  biggest: Catch | null
  recent: Catch[]
  // The ten heaviest catches ever.
  top: Catch[]
  // Size tags already explained once by a pop-up.
  seenGrades: SizeGrade[]
}

// What happened since the pane was opened, for the recap when it closes.
export type Outing = {
  caught: number
  escaped: number
  newSpecies: number
  best: Catch | null
}

// What the pane hands the game's surface module.
// One caught species in the rarest list: its tier and its best catch.
export type RareEntry = {
  name: string
  rarity: Rarity
  weightLb: number
  lengthIn: number
  count: number
  grade: SizeGrade | null
}

export type GameProps = {
  hooked: { id: string; difficulty: number; rarity: Rarity } | null
  last: Catch | null
  lastGrade: SizeGrade | null
  isClaudeBusy: boolean
  // Goes up each time Claude finishes a turn; the game flashes when it changes.
  claudeDoneCount: number
  rare: RareEntry[]
  heavy: RareEntry[]
}

declare module 'claude-code' {
  interface PluginState {
    megabite: {
      save: Shaped<Save>
      hooked: Shaped<Hooked | null>
      last: Shaped<Catch | null>
      isClaudeBusy: boolean
      isOpen: boolean
      isSoundOn: boolean
      claudeDoneCount: number
      outing: Shaped<Outing>
    }
  }
}
