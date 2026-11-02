import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MAX_TAGS } from '../config.js'
import { tagLabel } from '../lib/text.js'

// The hashtag "jar" on the entry step: a circle that fills as tags go in. Each new tag
// flies in from the input as a bubble, the others glide to make room, and every bubble
// bobs on its own. Tapping a bubble pops it out (removes it). Purely playful: the real
// typesetting happens on the Layout step.

const BUBBLE_COLOURS = ['#ffffff', '#ffffff', '#c9c4bb', '#ff5a3c', '#ffd600', '#ff4fa3']
const GAP = 8
const PAD_X = 28 // pill padding + room for the ×

let measureCtx = null
function textWidth(text, px) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')
  measureCtx.font = `800 ${px}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
  return measureCtx.measureText(text).width
}

// Rows of bubbles inside the circle: try 1, 2, 3… rows (evenly spaced, centred) and fill
// each row's chord greedily in order; shrink the font until everything fits.
function pack(labels, size) {
  const R = size / 2
  const n = labels.length
  if (!n) return { px: 20, spots: [] }
  for (let px = n <= 3 ? 24 : n <= 6 ? 20 : 17; px >= 11; px -= 1) {
    const widths = labels.map((l) => Math.min(textWidth(l, px) + PAD_X, size * 0.8))
    const rowH = px * 2.1
    for (let rows = 1; rows <= 7; rows++) {
      const block = rows * rowH
      if (block > size * 0.8) break
      const out = []
      let i = 0
      for (let r = 0; r < rows && i < n; r++) {
        const cy = R - block / 2 + rowH * (r + 0.5)
        const edge = Math.max(Math.abs(cy - rowH / 2 - R), Math.abs(cy + rowH / 2 - R))
        const chord = 2 * Math.sqrt(Math.max(0, (R * 0.9) ** 2 - edge ** 2))
        const row = []
        let used = 0
        while (i < n && used + widths[i] + (row.length ? GAP : 0) <= chord) {
          used += widths[i] + (row.length ? GAP : 0)
          row.push(i++)
        }
        let x = R - used / 2
        row.forEach((k) => { out[k] = { x: x + widths[k] / 2, y: cy }; x += widths[k] + GAP })
      }
      if (i === n) return { px, spots: out }
    }
  }
  // Fallback (very long tags): stack them down the middle.
  return { px: 11, spots: labels.map((_, k) => ({ x: R, y: R - (n / 2 - k - 0.5) * 24 })) }
}

// Stable per-tag randomness for the float, from its id.
function seeded(id, salt) {
  let h = 2166136261
  for (const c of `${id}${salt}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

export default function TagJar({ tags, onRemove }) {
  const box = useRef(null)
  const [size, setSize] = useState(320)
  const [leaving, setLeaving] = useState(() => new Set())
  const seen = useRef(null)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // New tags fly in; ones already there on first render (e.g. back from Layout) don't.
  // Kept in state for the length of the animation so re-renders don't cut it short.
  if (seen.current === null) seen.current = new Set(tags.map((t) => t.id))
  const [fresh, setFresh] = useState(() => new Set())
  useLayoutEffect(() => {
    const added = tags.filter((t) => !seen.current.has(t.id)).map((t) => t.id)
    if (!added.length) return
    added.forEach((id) => seen.current.add(id))
    setFresh((f) => new Set([...f, ...added]))
    const timer = setTimeout(() => setFresh((f) => {
      const n = new Set(f); added.forEach((id) => n.delete(id)); return n
    }), 900)
    return () => clearTimeout(timer)
  }, [tags])

  const labels = useMemo(() => tags.map(tagLabel), [tags])
  const { px, spots } = useMemo(() => pack(labels, size), [labels, size])
  const full = tags.length >= MAX_TAGS

  const pop = (id) => {
    setLeaving((s) => new Set(s).add(id))
    setTimeout(() => {
      onRemove(id)
      setLeaving((s) => { const n = new Set(s); n.delete(id); return n })
    }, 220)
  }

  return (
    <div className={`jar${full ? ' full' : ''}`} ref={box}>
      <div className="jar-fill" style={{ height: `${(tags.length / MAX_TAGS) * 100}%` }} aria-hidden="true" />
      {!tags.length && <p className="jar-empty">Your hashtags land here</p>}
      <ul className="jar-bubbles" aria-label="Your hashtags">
        {tags.map((t, i) => {
          const s = spots[i] || { x: size / 2, y: size / 2 }
          const colour = BUBBLE_COLOURS[i % BUBBLE_COLOURS.length]
          return (
            <li
              key={t.id}
              className={`bubble${fresh.has(t.id) ? ' fresh' : ''}${leaving.has(t.id) ? ' leaving' : ''}`}
              style={{
                left: s.x, top: s.y, fontSize: px,
                '--from-x': `${size / 2 - s.x}px`, '--from-y': `${-s.y - 70}px`,
                '--dur': `${3 + seeded(t.id, 'd') * 2.5}s`, '--delay': `${-seeded(t.id, 'l') * 3}s`,
                '--amp': `${3 + seeded(t.id, 'a') * 4}px`, '--tilt': `${(seeded(t.id, 't') - 0.5) * 6}deg`,
              }}
            >
              <button type="button" className="bubble-in" style={{ color: colour }}
                aria-label={`Remove ${labels[i]}`} onClick={() => pop(t.id)}>
                {labels[i]}<span aria-hidden="true">×</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
