// Typesets the hashtags into a sphere or a square, poster-style: tags are split into
// rows in the order given, and every row is scaled so it spans the shape's width at
// that height. Short rows come out big, long rows small — that size contrast is the
// look. Rows are not wrapped mid-tag.
//
// With at most 10 tags there are at most 2^9 = 512 ways to split the order into
// rows, so every split is scored and the best kept. A split scores well when
//   - the stack of rows fills the shape top to bottom (square) or sits centred in
//     the circle with equal margins (sphere), and covers it well, and
//   - each tag's resulting size follows its `weight` (the size the customer asked
//     for, relative to the others).
//
// Everything is in a design space of S × S units; drawing scales it.

import { fontCss, getFont, isRtl } from './fonts.js'
import { tagLabel } from './text.js'

export const S = 1000
const UNIT = 100 // font px that tags are measured at
const WORD_GAP = 0.26 // gap between tags in a row, × font size
const ROW_GAP = 0.018 * S
const SPHERE_FILL = 0.97 // keep ink just inside the circle

// Ink metrics of each tag at UNIT px.
export function measureTags(ctx, tags) {
  return tags.map((tag) => {
    ctx.font = fontCss(getFont(tag.fontId), UNIT)
    ctx.direction = isRtl(tag.text) ? 'rtl' : 'ltr'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    const m = ctx.measureText(tagLabel(tag))
    return {
      w: Math.max(1, m.actualBoundingBoxLeft + m.actualBoundingBoxRight),
      left: m.actualBoundingBoxLeft,
      asc: m.actualBoundingBoxAscent,
      desc: m.actualBoundingBoxDescent,
    }
  })
}

function rowsFor(mask, n) {
  const rows = []
  let start = 0
  for (let i = 0; i < n - 1; i++) {
    if (mask & (1 << i)) { rows.push([start, i + 1]); start = i + 1 }
  }
  rows.push([start, n])
  return rows
}

// Metrics already scaled by each tag's weight (see weighted()), so tags in one
// row keep their relative sizes and the row as a whole is stretched to fit.
function rowMetrics(ms, [from, to]) {
  let nw = 0, asc = 0, desc = 0
  for (let i = from; i < to; i++) {
    nw += ms[i].w
    if (i > from) nw += WORD_GAP * UNIT * Math.min(ms[i - 1].k, ms[i].k)
    asc = Math.max(asc, ms[i].asc)
    desc = Math.max(desc, ms[i].desc)
  }
  return { from, to, nw, asc, desc, lh: asc + desc }
}

function weighted(tags, ms) {
  return ms.map((m, i) => {
    const k = tags[i].weight || 1
    return { k, w: m.w * k, left: m.left * k, asc: m.asc * k, desc: m.desc * k }
  })
}

// ---- square: every row exactly S wide; row gaps absorb small height errors ----

function fitSquare(rows) {
  const scales = rows.map((r) => S / r.nw)
  const inkH = rows.reduce((s, r, i) => s + scales[i] * r.lh, 0)
  const n = rows.length
  const gap = n > 1 ? Math.min(0.05 * S, Math.max(0.01 * S, (S - inkH) / (n - 1))) : 0
  const total = inkH + gap * (n - 1)
  const tops = []
  let y = 0
  rows.forEach((r, i) => { tops.push(y); y += scales[i] * r.lh + gap })
  const mismatch = (total - S) / S
  return { scales, tops, total, mismatch, coverage: Math.min(1, total / S) }
}

// ---- sphere: each row as wide as the circle allows at its narrower edge ----

const R = S / 2
function chord(y) {
  const d = y - R
  const v = R * R - d * d
  return v > 0 ? 2 * Math.sqrt(v) : 0
}

function fitRowInCircle(r, yTop) {
  let lo = 0
  let hi = S / r.nw
  for (let k = 0; k < 16; k++) {
    const mid = (lo + hi) / 2
    const avail = SPHERE_FILL * Math.min(chord(yTop), chord(yTop + mid * r.lh))
    if (mid * r.nw <= avail) lo = mid
    else hi = mid
  }
  return lo
}

function runSphere(rows, t0) {
  const scales = []
  const tops = []
  let y = t0
  for (const r of rows) {
    const s = fitRowInCircle(r, y)
    tops.push(y)
    scales.push(s)
    y += s * r.lh + ROW_GAP
  }
  return { scales, tops, end: y - ROW_GAP }
}

function fitSphere(rows) {
  let best = null
  for (let k = 0; k <= 24; k++) {
    const t0 = (k / 24) * R
    const run = runSphere(rows, t0)
    if (run.end > S) continue
    const residual = Math.abs(S - run.end - t0)
    if (!best || residual < best.residual) best = { ...run, residual }
  }
  if (!best) best = { ...runSphere(rows, 0), residual: S }
  let ink = 0
  rows.forEach((r, i) => { ink += best.scales[i] * r.nw * best.scales[i] * r.lh })
  return {
    scales: best.scales,
    tops: best.tops,
    mismatch: best.residual / S,
    coverage: ink / (Math.PI * R * R),
  }
}

// Spread of log(actual size / wanted size) across tags: 0 when every tag is
// exactly as big, relative to the others, as its weight asks. A tag's size is
// its row scale × its weight, so the ratio is just the row scale.
function sizeSpread(rows, scales) {
  const v = []
  rows.forEach((r, i) => { for (let t = r.from; t < r.to; t++) v.push(Math.log(scales[i])) })
  const mean = v.reduce((a, b) => a + b, 0) / v.length
  return v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length
}

function bestSplit(tags, shape, raw) {
  const ms = weighted(tags, raw)
  const n = tags.length
  const fit = shape === 'square' ? fitSquare : fitSphere
  let best = null
  for (let mask = 0; mask < 1 << (n - 1); mask++) {
    const rows = rowsFor(mask, n).map((r) => rowMetrics(ms, r))
    const f = fit(rows)
    if (f.scales.some((s) => !(s > 0))) continue
    const cost = 6 * f.mismatch ** 2 + 2.5 * (1 - f.coverage) ** 2 + 1.2 * sizeSpread(rows, f.scales)
    if (!best || cost < best.cost) best = { cost, rows, f, ms }
  }
  return best
}

// Picks a starting order for the shape. A sphere needs short tags at the top and
// bottom, where the circle is narrow, and long ones across the middle; a square
// takes any order. Tries a few candidate orders and keeps the best-scoring one.
export function arrange(tags, shape, ms) {
  if (tags.length < 3) return tags
  const idx = tags.map((_, i) => i)
  const byWidth = [...idx].sort((a, b) => ms[a].w * (tags[a].weight || 1) - ms[b].w * (tags[b].weight || 1))
  // Organ pipe: shortest at both ends, longest in the middle.
  const pipe = []
  byWidth.forEach((i, k) => (k % 2 ? pipe.push(i) : pipe.unshift(i)))
  const candidates = [idx, pipe, [...pipe].reverse(), byWidth, [...byWidth].reverse()]
  let best = null
  for (const order of candidates) {
    const t = order.map((i) => tags[i])
    const m = order.map((i) => ms[i])
    const b = bestSplit(t, shape, m)
    if (b && (!best || b.cost < best.cost - 1e-9)) best = { cost: b.cost, order }
  }
  return best.order.map((i) => tags[i])
}

export function layoutDesign(tags, shape, ms) {
  if (!tags.length) return { placed: [], shape }
  const { rows, f, ms: wms } = bestSplit(tags, shape, ms)

  let placed = []
  rows.forEach((r, i) => {
    const s = f.scales[i]
    const rowW = s * r.nw
    const baseline = f.tops[i] + s * r.asc
    let x = (S - rowW) / 2
    for (let t = r.from; t < r.to; t++) {
      const m = wms[t]
      if (t > r.from) x += WORD_GAP * UNIT * s * Math.min(wms[t - 1].k, m.k)
      placed.push({
        id: tags[t].id,
        row: i,
        fontPx: UNIT * s * m.k,
        x,
        y: baseline - s * m.asc,
        w: s * m.w,
        h: s * (m.asc + m.desc),
        drawX: x + s * m.left,
        baseline,
      })
      x += s * m.w
    }
  })

  // Shrink to fit if the stack overflowed, then centre in the S × S box.
  const minY = Math.min(...placed.map((p) => p.y))
  const maxY = Math.max(...placed.map((p) => p.y + p.h))
  const k = Math.min(1, S / (maxY - minY))
  const dy = (S - (maxY - minY) * k) / 2 - minY * k
  const cx = S / 2
  placed = placed.map((p) => ({
    ...p,
    fontPx: p.fontPx * k,
    x: cx + (p.x - cx) * k,
    drawX: cx + (p.drawX - cx) * k,
    w: p.w * k,
    h: p.h * k,
    y: p.y * k + dy,
    baseline: p.baseline * k + dy,
  }))
  return { placed, shape }
}

// "Shuffle": a different arrangement that still forms the shape. Scores a batch of
// random orders plus small variations of the shape-filling order from arrange(),
// keeps the best few that differ from the current order, and picks one at random.
export function shuffle(tags, shape, ms, random = Math.random) {
  if (tags.length < 2) return tags
  const n = tags.length
  const idx = tags.map((_, i) => i)
  const key = (order) => order.join(',')
  const current = key(idx)
  const base = arrange(tags, shape, ms).map((t) => tags.indexOf(t))
  const seen = new Set([current])
  const candidates = []
  const add = (order) => { const k = key(order); if (!seen.has(k)) { seen.add(k); candidates.push(order) } }
  add(base)
  for (let c = 0; c < 18; c++) {
    const o = [...base]
    for (let s = 1 + Math.floor(random() * 3); s > 0; s--) {
      const i = Math.floor(random() * n)
      const j = Math.floor(random() * n)
      ;[o[i], o[j]] = [o[j], o[i]]
    }
    add(o)
  }
  for (let c = 0; c < 18; c++) {
    const o = [...idx]
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]] }
    add(o)
  }
  if (!candidates.length) return tags
  const scored = candidates
    .map((order) => ({ order, cost: bestSplit(order.map((i) => tags[i]), shape, order.map((i) => ms[i])).cost }))
    .sort((a, b) => a.cost - b.cost)
  const pool = scored.slice(0, Math.min(5, scored.length))
  return pool[Math.floor(random() * pool.length)].order.map((i) => tags[i])
}
