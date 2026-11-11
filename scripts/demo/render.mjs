// Draws the README demo: node scripts/demo/render.mjs [seed] [out]. `node scripts/demo/sim.mjs scan` lists seeds that land a fish.
import { writeFileSync } from 'node:fs'
import { simulate } from './sim.mjs'

const SEED = Number(process.argv[2] ?? 17), OUT = process.argv[3] ?? new URL('../../docs/demo.svg', import.meta.url).pathname
const { frames, fish, grade } = simulate(SEED)
const W = 60, CW = 9, LH = 20, FS = 15, DT = 0.1
const PAD = 20, BAR = 34
const paneX = PAD, paneY = BAR + PAD + 2 * LH + 8
const textX = paneX + 2 * CW, textY = paneY + LH
const width = PAD * 2 + (W + 4) * CW, height = paneY + 8 * LH + PAD - 4
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cells = segs => { const out = []; for (const s of segs) for (const ch of [...s.text]) out.push({ ...s, text: ch }); return out }
const runsOf = list => { const out = []; for (const c of list) { const p = out[out.length - 1]; if (p && p.color === c.color && p.bold === c.bold && p.bg === c.bg) p.text += c.text; else out.push({ ...c }) } return out }
const textRun = (seg, col, row) => {
  const body = seg.text.trim()
  if (!body) return ''
  const lead = [...seg.text].length - [...seg.text.trimStart()].length
  const n = [...body].length
  const x = textX + (col + lead) * CW, y = textY + row * LH
  return `<text x="${x}" y="${y}" textLength="${n * CW}" lengthAdjust="spacingAndGlyphs" fill="${seg.color ?? '#cfd8dc'}"${seg.bold ? ' font-weight="bold"' : ''}>${esc(body)}</text>`
}
const bgRun = (seg, col, row) => seg.bg ? `<rect x="${textX + col * CW}" y="${textY + row * LH - 15}" width="${[...seg.text].length * CW}" height="${LH}" fill="${seg.bg}"/>` : ''
const SPIN = ['✻', '✶', '✳', '✢', '·', '✢', '✳', '✶']

const pieceDefs = new Map()
const piece = markup => { if (!markup) return ''; if (!pieceDefs.has(markup)) pieceDefs.set(markup, `p${pieceDefs.size}`); return `<use href="#${pieceDefs.get(markup)}"/>` }
const body = frames.map((f, i) => {
  let out = ''
  // chat side: prompt and Claude's status
  const busy = f.accent === undefined ? true : null
  f.rows.forEach((segs, r) => {
    let col = 0, row = ''
    for (const seg of runsOf(cells(segs).map(c => ({ ...c, bg: undefined })))) { row += textRun(seg, col, r); col += [...seg.text].length }
    out += piece(row)
  })
  const footRow = 5
  let col = 0, foot = ''
  for (const seg of f.foot) { foot += bgRun(seg, col, footRow) + textRun(seg, col, footRow); col += [...seg.text].length }
  const bw = [...f.badge.text].length
  foot += bgRun(f.badge, W - bw, footRow) + textRun(f.badge, W - bw, footRow)
  out += piece(foot)
  out = piece(`<rect x="${paneX + 4}" y="${paneY + 4}" width="${(W + 4) * CW - 8}" height="${7 * LH - 8}" rx="10" fill="none" stroke="${f.accent}" stroke-width="2"/>`) + out
  return out
})

// Claude's status line above the pane: working until the done flash starts.
const doneAt = frames.findIndex(f => f.badge.text.includes('Claude done') || f.badge.text.includes('✓'))
const status = frames.map((_, i) =>
  doneAt >= 0 && i >= doneAt
    ? `<text x="${PAD}" y="${BAR + PAD + LH}" fill="#66bb6a">●</text><text x="${PAD + 2 * CW}" y="${BAR + PAD + LH}" fill="#cfd8dc">Done. All 214 tests pass.</text>`
    : `<text x="${PAD}" y="${BAR + PAD + LH}" fill="#ff8a65">${SPIN[i % SPIN.length]}</text><text x="${PAD + 2 * CW}" y="${BAR + PAD + LH}" fill="#ff8a65">Working… <tspan fill="#78909c">(${(i * DT).toFixed(0)}s · esc to interrupt)</tspan></text>`)

// Dedupe identical frames into defs; each time slot shows one through a <use>.
const ids = new Map(), defs = []
const slots = body.map((b, i) => {
  const key = piece(status[i]) + b
  if (!ids.has(key)) { ids.set(key, `f${ids.size}`); defs.push(`<g id="${ids.get(key)}">${key}</g>`) }
  return ids.get(key)
})
// Merge consecutive equal slots into one longer slot.
const merged = []
for (const id of slots) { const p = merged[merged.length - 1]; if (p && p.id === id) p.n++; else merged.push({ id, n: 1 }) }
const T = (frames.length * DT + 2.5).toFixed(2)
const durations = [...new Set(merged.map(m => m.n))]
let t = 0, uses = ''
merged.forEach((m, i) => {
  const isLast = i === merged.length - 1
  uses += `<use href="#${m.id}" class="${isLast ? 'z' : 'd' + m.n}" style="animation-delay:${t.toFixed(2)}s"/>`
  t += m.n * DT
})
const pct = n => ((n * DT) / T * 100).toFixed(3)
const css = `.d,.z,${durations.map(n => '.d' + n).join(',')}{visibility:hidden;animation-duration:${T}s;animation-iteration-count:infinite;animation-timing-function:step-end}
${durations.map(n => `.d${n}{animation-name:k${n}}@keyframes k${n}{0%{visibility:visible}${pct(n)}%{visibility:hidden}100%{visibility:hidden}}`).join('\n')}
.z{animation-name:kz}@keyframes kz{0%{visibility:visible}${((2.5 + (merged.at(-1).n) * DT) / T * 100).toFixed(3)}%{visibility:hidden}100%{visibility:hidden}}`

// Static water backgrounds from the first frame.
let water = ''
frames[0].rows.forEach((segs, r) => { let col = 0; for (const seg of runsOf(cells(segs).map(c => ({ text: c.text, bg: c.bg })))) { water += bgRun(seg, col, r); col += [...seg.text].length } })

const svg = `<svg xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Menlo, Monaco, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', monospace" font-size="${FS}">
<style>text{white-space:pre}${css}</style>
<rect width="${width}" height="${height}" rx="12" fill="#14121f"/>
<rect width="${width}" height="${BAR}" rx="12" fill="#221e33"/><rect y="${BAR - 12}" width="${width}" height="12" fill="#221e33"/>
<circle cx="20" cy="17" r="6" fill="#ff5f57"/><circle cx="40" cy="17" r="6" fill="#febc2e"/><circle cx="60" cy="17" r="6" fill="#28c840"/>
<text x="${width / 2}" y="22" text-anchor="middle" fill="#8a84a8" font-size="13">claude · ~/project</text>
<text x="${PAD}" y="${BAR + PAD}" fill="#78909c">&gt; <tspan fill="#cfd8dc">fix the flaky parser tests</tspan></text>
${water}
<defs>${[...pieceDefs].map(([m, id]) => `<g id="${id}">${m}</g>`).join('\n')}
${defs.join('\n')}</defs>
${uses}
</svg>`
writeFileSync(OUT, svg)
if (process.env.STILLS) for (const i of process.env.STILLS.split(',').map(Number)) {
  const id = slots[i]
  writeFileSync(`still-${i}.svg`, svg.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<use href="#f\d+"[^>]*\/>/g, '').replace('</svg>', `<use href="#${id}"/></svg>`))
}
console.log(OUT, (svg.length / 1024).toFixed(0) + 'KB', frames.length, 'frames', merged.length, 'slots', defs.length, 'defs', fish?.name, grade, 'T', T)
