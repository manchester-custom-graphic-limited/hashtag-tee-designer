// Bridge to the MCGT shop cart (window.McgtCart, loaded from /shared/cart-store.js on
// the deployed site) — same contract as battle-stat-image-generator's cartBridge.
// Prices and sizes are read from the public catalogue sheet so it stays the single
// source of truth; they are display-only, because the square-checkout Cloud Function
// reprices every order server-side.

import { PRODUCT_ID } from '../config.js'
import { sale } from './sale.js'

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
  // A sale (sale_price + sale_ends_at, on the Variants row or else the Products row) is
  // checked by ./sale.js, the same rule the checkout function charges by. Worked out on
  // each call, so an offer that ends while the page is open ends.
  const cellOf = (H, r, name) => (H.head[name] == null ? '' : r[H.head[name]] ?? '')
  const pSale = [cellOf(P, row, 'sale_price'), cellOf(P, row, 'sale_ends_at')]
  const variants = {}
  V.body
    .filter((r) => String(r[V.head.product_id]).trim() === id)
    .forEach((r) => {
      const p = Number(r[V.head.price])
      const vSale = [cellOf(V, r, 'sale_price'), cellOf(V, r, 'sale_ends_at')]
      variants[String(r[V.head.colour]).trim()] = {
        regular: p > 0 ? p : base,
        sale: String(vSale[0]).trim() !== '' ? vSale : pSale,
      }
    })
  if (!sizes.length || !(base > 0 || Object.keys(variants).length)) return null
  const saleFor = (colour) => {
    const v = variants[colour] || { regular: base, sale: pSale }
    return sale(v.regular, v.sale[0], v.sale[1])
  }
  return {
    id,
    name: String(row[P.head.name] || 'Hashtag Tee').trim(),
    weight,
    sizes,
    priceFor: (colour) => saleFor(colour).price,
    wasFor: (colour) => saleFor(colour).was,
    endsFor: (colour) => saleFor(colour).ends,
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
