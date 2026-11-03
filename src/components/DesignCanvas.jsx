import { useEffect, useLayoutEffect, useRef } from 'react'
import { drawDesign, drawTag } from '../lib/draw.js'
import { S } from '../lib/layout.js'
import { inkFor } from '../lib/style.js'

const FIELDS = ['x', 'y', 'w', 'h', 'fontPx', 'drawX', 'baseline']
const EASE = 0.2

// The typeset design on a tee-coloured panel. Tags glide to their layout slots.
// Dragging a tag over another reorders the list; the parent re-typesets, so the
// other tags are pushed and squeezed and the whole block re-forms its shape.
// popIn: tags added after the first paint grow into their slot from a dot.
// onTap (with interactive off): tapping a tag calls onTap(id) instead of select/drag.
//
// tap: select · drag: move · arrows ←/→ on a selected tag: move it earlier/later
export default function DesignCanvas({
  tags, layout, teeColour, teeHex, highlight, selectedId, onSelect, onReorder, interactive = true,
  popIn = false, onTap,
}) {
  const canvasRef = useRef(null)
  const size = useRef({ css: 1, dpr: 1 })
  const anim = useRef({}) // id → displayed placement
  const drag = useRef(null)
  const frame = useRef(0)
  const painted = useRef(false)
  const props = useRef()
  props.current = { tags, layout, teeColour, teeHex, highlight, selectedId }

  const target = () => Object.fromEntries(props.current.layout.placed.map((p) => [p.id, p]))

  const paint = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { css, dpr } = size.current
    const { tags: list, teeHex: bg, teeColour: tee, highlight: hl, selectedId: sel, layout: lay } = props.current
    const ctx = canvas.getContext('2d')
    const k = css / S
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, css, css)

    // Faint guide of the shape being formed.
    ctx.save()
    ctx.strokeStyle = tee === 'Black' ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 6])
    if (lay.shape === 'sphere') {
      ctx.beginPath()
      ctx.arc(css / 2, css / 2, Math.max(0, css / 2 - 1), 0, Math.PI * 2)
      ctx.stroke()
    } else ctx.strokeRect(0.5, 0.5, css - 1, css - 1)
    ctx.restore()

    const d = drag.current?.active ? drag.current.id : null
    drawDesign(ctx, { tags: list, placed: lay.placed, teeColour: tee, highlight: hl, size: css, pos: anim.current, skip: d })

    const box = (p, color, width) => {
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.setLineDash([5, 4])
      ctx.strokeRect(p.x * k - 5, p.y * k - 5, p.w * k + 10, p.h * k + 10)
      ctx.restore()
    }
    if (sel && !d && anim.current[sel]) box(anim.current[sel], '#1e88e5', 2)

    if (d && anim.current[d]) {
      const tag = list.find((t) => t.id === d)
      const p = anim.current[d]
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,.45)'
      ctx.shadowBlur = 18
      ctx.shadowOffsetY = 6
      drawTag(ctx, tag, p, k, inkFor(tag, tee, hl))
      ctx.restore()
      box(p, '#1e88e5', 2)
    }
  }

  // Ease every tag toward its slot; stop the loop once everything has settled.
  const tick = () => {
    frame.current = 0
    const tgt = target()
    let moving = false
    for (const [id, t] of Object.entries(tgt)) {
      const a = anim.current[id]
      if (!a) {
        if (popIn && painted.current) {
          // Start at 15% size around the slot's centre; the easing below grows it in.
          const s = 0.15
          const cx = t.x + t.w / 2
          const cy = t.y + t.h / 2
          const x = cx - (t.w * s) / 2
          const y = cy - (t.h * s) / 2
          anim.current[id] = {
            x, y, w: t.w * s, h: t.h * s, fontPx: t.fontPx * s,
            drawX: x + (t.drawX - t.x) * s, baseline: y + (t.baseline - t.y) * s,
          }
          moving = true
        } else anim.current[id] = { ...t }
        continue
      }
      if (drag.current?.active && drag.current.id === id) continue
      for (const f of FIELDS) {
        const delta = t[f] - a[f]
        if (Math.abs(delta) > 0.3) { a[f] += delta * EASE; moving = true } else a[f] = t[f]
      }
    }
    for (const id of Object.keys(anim.current)) if (!tgt[id]) delete anim.current[id]
    paint()
    painted.current = true
    if (moving) frame.current = requestAnimationFrame(tick)
  }
  const kick = () => { if (!frame.current) frame.current = requestAnimationFrame(tick) }

  useEffect(() => { kick() })
  useEffect(() => () => { cancelAnimationFrame(frame.current); frame.current = 0 }, [])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const ro = new ResizeObserver(() => {
      const css = canvas.getBoundingClientRect().width
      const dpr = Math.min(3, window.devicePixelRatio || 1)
      size.current = { css, dpr }
      canvas.width = Math.round(css * dpr)
      canvas.height = Math.round(css * dpr)
      paint()
    })
    ro.observe(canvas)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toUnits = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    const k = S / r.width
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]
  }
  const inside = (p, [x, y], pad = 0) => x >= p.x - pad && x <= p.x + p.w + pad && y >= p.y - pad && y <= p.y + p.h + pad

  const tagAt = (pt) => {
    const placed = props.current.layout.placed
    for (let i = placed.length - 1; i >= 0; i--) if (inside(anim.current[placed[i].id] || placed[i], pt, 12)) return placed[i].id
    return null
  }

  const onPointerDown = (e) => {
    if (!interactive) {
      const id = onTap && tagAt(toUnits(e))
      if (id) onTap(id)
      return
    }
    const pt = toUnits(e)
    const id = tagAt(pt)
    if (!id) { onSelect(null); return }
    const a = anim.current[id]
    drag.current = { id, start: pt, active: false, fx: (pt[0] - a.x) / a.w, fy: (pt[1] - a.y) / a.h, pointerId: e.pointerId }
    canvasRef.current.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    const g = drag.current
    if (!g || g.pointerId !== e.pointerId) return
    const pt = toUnits(e)
    if (!g.active) {
      if (Math.hypot(pt[0] - g.start[0], pt[1] - g.start[1]) < 10) return
      g.active = true
      onSelect(g.id)
    }
    // The dragged tag follows the finger at the size of its current slot.
    const t = target()[g.id]
    anim.current[g.id] = {
      ...t,
      x: pt[0] - g.fx * t.w,
      y: pt[1] - g.fy * t.h,
      drawX: pt[0] - g.fx * t.w + (t.drawX - t.x),
      baseline: pt[1] - g.fy * t.h + (t.baseline - t.y),
    }
    // Over another tag → take its place: before it on its left half, after it on
    // its right. Only while actually over a tag, so the order doesn't flicker as
    // the block re-forms under the finger.
    const over = props.current.layout.placed.find((p) => p.id !== g.id && inside(p, pt))
    if (over) {
      const ids = props.current.tags.map((x) => x.id).filter((id) => id !== g.id)
      const at = ids.indexOf(over.id) + (pt[0] > over.x + over.w / 2 ? 1 : 0)
      ids.splice(at, 0, g.id)
      if (ids.join() !== props.current.tags.map((x) => x.id).join()) onReorder(ids)
    }
    kick()
    paint()
  }

  const onPointerUp = (e) => {
    const g = drag.current
    if (!g || g.pointerId !== e.pointerId) return
    if (!g.active) onSelect(g.id)
    drag.current = null
    kick()
  }

  const onKeyDown = (e) => {
    if (!selectedId || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
    e.preventDefault()
    const ids = tags.map((t) => t.id)
    const i = ids.indexOf(selectedId)
    const j = Math.max(0, Math.min(ids.length - 1, i + (e.key === 'ArrowLeft' ? -1 : 1)))
    if (i === j) return
    ids.splice(i, 1)
    ids.splice(j, 0, selectedId)
    onReorder(ids)
  }

  return (
    <canvas
      ref={canvasRef}
      className={`design-canvas ${layout.shape}`}
      tabIndex={interactive ? 0 : -1}
      aria-label={interactive ? 'Your hashtag design. Tap a hashtag to edit it, drag it to move it.'
        : onTap ? 'Your hashtags, typeset. Tap one to remove it.' : 'A sample hashtag design.'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    />
  )
}
