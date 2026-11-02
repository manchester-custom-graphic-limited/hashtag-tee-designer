import { DESIGN_MM, DPI_LADDER, PLACEMENT } from '../config.js'
import { drawDesign } from './draw.js'
import { getFont } from './fonts.js'

const MM_PER_INCH = 25.4

function toBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

// Renders the design (see draw.js) into a transparent square canvas `px` wide.
export function renderDesignCanvas(design, px) {
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas too large')
  drawDesign(ctx, { ...design, size: px })
  return canvas
}

// The print file: a transparent PNG, DESIGN_MM square, with the physical size in
// pHYs (print software opens it at true size) and the whole design as JSON in an
// iTXt chunk so an order can be reproduced or reprinted exactly.
export async function renderPrintPng(design) {
  let lastError
  for (const dpi of DPI_LADDER) {
    try {
      const px = Math.round((DESIGN_MM / MM_PER_INCH) * dpi)
      const blob = await toBlob(renderDesignCanvas(design, px))
      // Any real design compresses to well over this; smaller means the browser
      // handed back a blank canvas.
      if (!blob || blob.size < 1500) throw new Error('Blank canvas')
      const meta = {
        kind: 'mcgt-hashtag-tee',
        version: 2,
        teeColour: design.teeColour,
        side: design.side,
        shape: design.shape,
        lineSpacing: design.lineSpacing ?? 1,
        dpi,
        sizeMm: DESIGN_MM,
        placement: `${design.side}: centred, top edge ${PLACEMENT[design.side].topBelowCollarMm} mm below the collar seam`,
        tags: design.tags.map((t) => ({ ...t, font: getFont(t.fontId).family })),
        layout: design.placed,
      }
      const bytes = await withPngChunks(blob, dpi, JSON.stringify(meta))
      return { blob: new Blob([bytes], { type: 'image/png' }), dpi }
    } catch (err) {
      lastError = err
    }
  }
  throw lastError || new Error('Could not render the print file.')
}

// ---------------------------------------------------------------------------
// PNG chunk writing (pHYs + iTXt), inserted straight after IHDR.
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  const typeBytes = new TextEncoder().encode(type)
  out.set(typeBytes, 4)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

function physChunk(dpi) {
  const ppm = Math.round(dpi / 0.0254)
  const data = new Uint8Array(9)
  const view = new DataView(data.buffer)
  view.setUint32(0, ppm)
  view.setUint32(4, ppm)
  data[8] = 1 // unit: metre
  return chunk('pHYs', data)
}

function itxtChunk(keyword, text) {
  const enc = new TextEncoder()
  const kw = enc.encode(keyword)
  const body = enc.encode(text)
  // keyword \0 compression-flag compression-method language \0 translated \0 text
  const data = new Uint8Array(kw.length + 5 + body.length)
  data.set(kw, 0)
  data.set(body, kw.length + 5)
  return chunk('iTXt', data)
}

export async function withPngChunks(blob, dpi, json) {
  const src = new Uint8Array(await blob.arrayBuffer())
  const afterIhdr = 8 + 25 // signature + IHDR (4 len + 4 type + 13 data + 4 crc)
  const extra = [physChunk(dpi), itxtChunk('mcgt-design', json)]
  const size = src.length + extra.reduce((s, c) => s + c.length, 0)
  const out = new Uint8Array(size)
  out.set(src.subarray(0, afterIhdr), 0)
  let at = afterIhdr
  for (const c of extra) {
    out.set(c, at)
    at += c.length
  }
  out.set(src.subarray(afterIhdr), at)
  return out
}
