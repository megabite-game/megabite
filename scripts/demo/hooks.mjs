// Lets Node load the game's TypeScript imports, which leave off the .ts extension.
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
registerHooks({
  resolve(spec, ctx, next) {
    if ((spec.startsWith('./') || spec.startsWith('../')) && !/\.\w+$/.test(spec) && ctx.parentURL) {
      for (const ext of ['.ts', '.d.ts']) {
        const url = new URL(spec + ext, ctx.parentURL)
        if (existsSync(fileURLToPath(url))) return next(url.href, ctx)
      }
    }
    return next(spec, ctx)
  },
})
