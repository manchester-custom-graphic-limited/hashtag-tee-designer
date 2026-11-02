// Bridge to the MCGT shop cart (window.McgtCart, loaded from /shared/cart-store.js on
// the deployed site) — same contract as battle-stat-image-generator's cartBridge.
// Prices and sizes are read from the public catalogue sheet so it stays the single
// source of truth; they are display-only, because the square-checkout Cloud Function
// reprices every order server-side.

import { PRODUCT_ID } from '../config.js'

const SHEET_ID = '1yHxRDrkORN1wC5FEvo91uc5Ba0utf8Ck1J7TM61kqw0'

function csvUrl(tab) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`
}

// Minimal RFC-4180 CSV parser (same as the shop pages).
function parseCSV(text) {
  const rows = []
  let row = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false
      } else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = [] }
    else if (c !== '\r') field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

function headed(rows) {
  const head = {}
  if (rows.length) rows[0].forEach((h, i) => { head[String(h).trim().toLowerCase()] = i })
  return { head, body: rows.slice(1) }
}

export function readProduct(P, V, id) {
  const row = P.body.find((r) => String(r[P.head.id]).trim() === id)
  if (!row) return null
  if (P.head.active != null && String(row[P.head.active]).trim().toUpperCase() === 'FALSE') return null
  const base = Number(row[P.head.price]) || 0
  const weight = Number(row[P.head.weight]) || 200
  const sizes = String(row[P.head.sizes] || '').split(',').map((s) => s.trim()).filter(Boolean)
  // Per-colour variant prices override the product price (black costs more to print).
  // A variant price below the product price is shown as an offer: the product price
  // is the regular one, struck through. Ending the offer = raise the variants back.
  const prices = {}
  V.body
    .filter((r) => String(r[V.head.product_id]).trim() === id)
    .forEach((r) => {
      const p = Number(r[V.head.price])
      if (p > 0) prices[String(r[V.head.colour]).trim()] = p
    })
  if (!sizes.length || !(base > 0 || Object.keys(prices).length)) return null
  return {
    id,
    name: String(row[P.head.name] || 'Hashtag Tee').trim(),
    weight,
    sizes,
    priceFor: (colour) => prices[colour] || base,
    wasFor: (colour) => (prices[colour] && base > prices[colour] ? base : null),
  }
}

// Loads the hashtag tee. null when it isn't in the sheet yet, is inactive, or the
// sheet is unreachable; the UI then blocks ordering with a hint.
export async function fetchProduct() {
  try {
    const [prodText, varText] = await Promise.all([
      fetch(csvUrl('Products')).then((r) => r.text()),
      fetch(csvUrl('Variants')).then((r) => r.text()),
    ])
    const P = headed(parseCSV(prodText))
    const V = headed(parseCSV(varText))
    return readProduct(P, V, PRODUCT_ID)
  } catch {
    return null
  }
}

export function cartAvailable() {
  return typeof window !== 'undefined' && Boolean(window.McgtCart)
}

// Stores the print PNG in IndexedDB and appends a cart line pointing at it. Each
// design is its own line (artworkId is part of the line identity).
export async function addHashtagLineToCart({ product, colour, blob, thumb, designLabel, uploadName, size, qty }) {
  const McgtCart = window.McgtCart
  const artworkId = McgtCart.newArtworkId()
  await McgtCart.putArtwork(artworkId, blob)
  const line = {
    productId: product.id,
    name: product.name,
    colour,
    size,
    qty,
    price: product.priceFor(colour),
    weight: product.weight,
    artworkId,
    thumb,
    designLabel,
    uploadName,
  }
  McgtCart.addLine(line)
  return line
}
