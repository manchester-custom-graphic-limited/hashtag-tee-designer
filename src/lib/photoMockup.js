import { DESIGN_MM, PLACEMENT } from '../config.js'

// Preview mock-ups from real tee photos: blank black and white tees, front view,
// from the same studio shoot (Pixabay, user nattyjeff, images 1886001 / 1886013;
// Pixabay Content License — free for commercial use, no attribution required).
// Files: public/tees/{black,white}-front.png, transparent, 1274 × 1280.
//
// There is no matching back-view photo, so the back is made from the front: the
// scooped front neckline is filled with fabric copied from lower on the same photo
// (same texture and light), and a high back collar rib is drawn along the top edge.
//
// Geometry below is in photo pixels, measured from the files. A Gildan M body is
// taken as 520 mm across.

const BODY_MM = 520

const PHOTOS = {
  Black: {
    file: 'black-front.png',
    centreX: 640,
    bodyPx: 569,
    tips: [[500, 143], [738, 143]], // where the collar meets the shoulder seams
    collarTop: 177, // top edge of the (back) collar at the centre
    frontSeam: 250, // lowest point of the front collar seam
    ink: 'soft-light',
    rib: 'rgba(255,255,255,.05)',
    seam: 'rgba(255,255,255,.10)',
    label: '#2a2a2a',
  },
  White: {
    file: 'white-front.png',
    centreX: 628,
    bodyPx: 575,
    tips: [[507, 97], [730, 97]],
    collarTop: 132,
    frontSeam: 232,
    ink: 'multiply',
    rib: 'rgba(0,0,0,.04)',
    seam: 'rgba(0,0,0,.16)',
    label: '#d9d6cf',
  },
}

const RIB_PX = 16

const cache = new Map()
function loadPhoto(colour) {
  if (!cache.has(colour)) {
    const img = new Image()
    img.src = `${import.meta.env.BASE_URL}tees/${PHOTOS[colour].file}`
    cache.set(colour, img.decode().then(() => img))
  }
  return cache.get(colour)
}

// Quadratic through both tips with its lowest point at `depth` on the centre line.
function neckCurve(ctx, p, depth, dy = 0) {
  const [[x0, y0], [x1, y1]] = p.tips
  const cy = 2 * depth - (y0 + y1) / 2
  ctx.moveTo(x0, y0 + dy)
  ctx.quadraticCurveTo((x0 + x1) / 2, cy + dy, x1, y1 + dy)
}

function paintBack(ctx, img, p) {
  // 1. Cover the front neckline with fabric from 160 px lower, only where the
  //    photo is already opaque (source-atop keeps the silhouette).
  ctx.save()
  ctx.beginPath()
  neckCurve(ctx, p, p.collarTop, -12)
  const [[x0, y0], [x1, y1]] = p.tips
  const cy = 2 * (p.frontSeam + 10) - (y0 + y1) / 2
  ctx.lineTo(x1 + 30, y1 + 20)
  ctx.quadraticCurveTo((x0 + x1) / 2, cy, x0 - 30, y0 + 20)
  ctx.closePath()
  ctx.clip()
  ctx.globalCompositeOperation = 'source-atop'
  ctx.drawImage(img, 0, 160, img.width, img.height - 160, 0, 0, img.width, img.height - 160)
  ctx.restore()

  // 2. The back collar: a rib band along the top edge, its seam, and a neck label.
  ctx.save()
  ctx.globalCompositeOperation = 'source-atop'
  ctx.lineCap = 'round'
  ctx.beginPath()
  neckCurve(ctx, p, p.collarTop, RIB_PX / 2)
  ctx.strokeStyle = p.rib
  ctx.lineWidth = RIB_PX
  ctx.stroke()
  ctx.beginPath()
  neckCurve(ctx, p, p.collarTop, RIB_PX + 1)
  ctx.strokeStyle = p.seam
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = p.label
  ctx.fillRect((x0 + x1) / 2 - 16, p.collarTop + RIB_PX + 3, 32, 14)
  ctx.restore()
}

// Where the DESIGN_MM square sits on the photo, in photo pixels.
function designBox(p, side) {
  const pxPerMm = p.bodyPx / BODY_MM
  const collar = side === 'front' ? p.frontSeam : p.collarTop + RIB_PX
  const size = DESIGN_MM * pxPerMm
  return { x: p.centreX - size / 2, y: collar + PLACEMENT[side].topBelowCollarMm * pxPerMm, size }
}

// Composes the tee photo (front, or the derived back) with the design on it.
// `design` is a square canvas with a transparent background. Returns a canvas
// at the photo's own resolution.
export async function composeMockup({ teeColour, side, design }) {
  const p = PHOTOS[teeColour]
  const img = await loadPhoto(teeColour)
  const out = document.createElement('canvas')
  out.width = img.width
  out.height = img.height
  const ctx = out.getContext('2d')
  ctx.drawImage(img, 0, 0)
  if (side === 'back') paintBack(ctx, img, p)

  if (design) {
    // Ink layer: the design, then the fabric's light and folds blended into it,
    // then trimmed back to the design's own shape.
    const box = designBox(p, side)
    const ink = document.createElement('canvas')
    ink.width = out.width
    ink.height = out.height
    const ictx = ink.getContext('2d')
    ictx.drawImage(design, box.x, box.y, box.size, box.size)
    ictx.globalCompositeOperation = p.ink
    ictx.globalAlpha = p.ink === 'multiply' ? 1 : 0.7
    ictx.drawImage(out, 0, 0)
    ictx.globalAlpha = 1
    ictx.globalCompositeOperation = 'destination-in'
    ictx.drawImage(design, box.x, box.y, box.size, box.size)
    ctx.drawImage(ink, 0, 0)
  }
  return out
}

export async function mockupJpeg(opts, width = 320) {
  const full = await composeMockup(opts)
  const c = document.createElement('canvas')
  c.width = width
  c.height = Math.round(width * (full.height / full.width))
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#e9e7e2'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(full, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85)
}
