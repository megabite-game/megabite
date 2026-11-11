# MegaBite

A small fishing game that lives in a pane beside your Claude Code chat, for the moments you're waiting on Claude. Cast, set the hook, reel in, and build a collection of 50 real fish across five rarity tiers. Your catches are saved on your machine across sessions, and the game flashes (and, if you unmute it, chimes) when Claude finishes.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install megabite --marketplace Karnveer-Grewal/megabite
```

Answer `y` to add the marketplace, then pick a scope (Enter takes the user scope, so it loads in every session).

From a shell:

```
claude plugin install megabite --marketplace Karnveer-Grewal/megabite
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `Karnveer-Grewal/megabite`, then Add plugin.

## Play

Type `/fish` to open the game, even while Claude is working. Click the pane once if your keys still go to the chat.

| Key | Does |
| --- | --- |
| Space or Enter | cast (press again to release), set the hook, reel in |
| ← | let line out when the line strains or ↯ flashes |
| Tab | records: Rarest, Heaviest, back to the water |
| m | mute or unmute the chime (muted by default) |
| Esc or q | close (Esc also works from the chat, but only at an empty prompt while Claude is idle: mid-turn, Esc there stops Claude) |

Reeling: keep the ◆ in the green. Too far right snaps the line; too slack and the fish shakes loose. Rarer fish run, head-shake and wear your line.

- **Rarity** shows in the fish's name colour: Common, Uncommon, Rare, Epic, Legendary, based on how often anglers meet the fish in real life.
- **Cast distance** matters: short casts reach near-shore fish, long casts deep-water ones and rarer tiers.
- **Size tags** compare a catch with others of its species: `BIG` is the heaviest 1 in 10, `TROPHY` 1 in 30, `★ RECORD` 1 in 60, the same odds for every fish. Maximum sizes are checked against IGFA and FishBase records.

## Commands

| Command | Shows |
| --- | --- |
| `/fish` | open the game |
| `/fish dex` | your collection by tier, with hints for undiscovered fish |
| `/fish top` | your 10 heaviest catches |
| `/fish rare` | your rarest species, best of each, with size tags |
| `/fish stats` | totals, heaviest, rarest, species found |
| `/fish mute` / `/fish unmute` | the chime when Claude finishes |
| `/fish sound` | whether the chime is muted |
| `/fish help` | keys, rules and tags |
| `/fish close` | close the game |

Closing the game adds a one-line recap of the outing to your chat (shown to you only, never sent to Claude).

## Develop

```
claude --plugin-dir /path/to/megabite   # run it from this folder
claude plugin test /path/to/megabite    # run the tests
claude plugin validate /path/to/megabite
```

Type checking needs the plugin API's types, which Claude Code writes to `.claude-plugin/types/` (not committed) when it loads the plugin from this folder. Run `claude --plugin-dir .` once, then `npx tsc -p .`.

Pull requests are welcome.

## License

MIT. See [LICENSE](LICENSE).
