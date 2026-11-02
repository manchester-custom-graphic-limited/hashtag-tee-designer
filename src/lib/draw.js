import { fontCss, getFont, isRtl } from './fonts.js'
import { S } from './layout.js'
import { inkFor } from './style.js'
import { tagLabel } from './text.js'

// Draws the design (layout space S × S) into a size × size box at the current
// transform. `pos` optionally overrides a tag's placement (animation, dragging).
export function drawDesign(ctx, { tags, placed, teeColour, highlight, size, pos = {}, skip }) {
  const k = size / S
  const byId = Object.fromEntries(placed.map((p) => [p.id, p]))
  for (const tag of tags) {
    if (tag.id === skip) continue
    const p = pos[tag.id] || byId[tag.id]
    if (!p) continue
    drawTag(ctx, tag, p, k, inkFor(tag, teeColour, highlight))
  }
}

export function drawTag(ctx, tag, p, k, color) {
  ctx.save()
  ctx.font = fontCss(getFont(tag.fontId), p.fontPx * k)
  ctx.direction = isRtl(tag.text) ? 'rtl' : 'ltr'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = color
  ctx.fillText(tagLabel(tag), p.drawX * k, p.baseline * k)
  ctx.restore()
}
