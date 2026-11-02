import { HIGHLIGHTS, TEE_COLOURS } from '../config.js'

// Every tag has a colour role — main, grey or highlight — rather than a fixed
// colour, so switching the tee from black to white recolours the design sensibly.
// A tag only keeps a fixed hex if the customer picked a custom colour.

export const ROLES = [
  { id: 'main', label: 'Main' },
  { id: 'muted', label: 'Grey' },
  { id: 'accent', label: 'Highlight' },
]

const MAIN = { Black: '#ffffff', White: '#111111' }
const MUTED = { Black: '#7c7c7c', White: '#9b9b9b' }

export function teeHex(teeColour) {
  return TEE_COLOURS.find((c) => c.id === teeColour).hex
}

function luminance(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// The highlight swatches that read on this tee.
export function highlightsFor(teeColour) {
  return HIGHLIGHTS.filter((h) => contrast(h, teeHex(teeColour)) >= 2)
}

export function inkFor(tag, teeColour, highlight) {
  if (tag.color) return tag.color
  if (tag.role === 'muted') return MUTED[teeColour]
  if (tag.role === 'accent') {
    const ok = highlightsFor(teeColour)
    return ok.includes(highlight) ? highlight : ok[0]
  }
  return MAIN[teeColour]
}

// First-pass styling from the layout: the biggest tag (two, with 7+ tags) is
// highlighted, the smallest third goes grey, the rest are the main colour.
export function autoRoles(tags, placed) {
  const size = Object.fromEntries(placed.map((p) => [p.id, p.fontPx]))
  const bySize = [...tags].sort((a, b) => (size[b.id] || 0) - (size[a.id] || 0))
  const accents = tags.length >= 7 ? 2 : 1
  const muted = tags.length >= 3 ? Math.floor(tags.length / 3) : 0
  const role = {}
  bySize.forEach((t, i) => {
    role[t.id] = i < accents ? 'accent' : i >= bySize.length - muted ? 'muted' : 'main'
  })
  return tags.map((t) => ({ ...t, role: role[t.id], color: undefined }))
}
