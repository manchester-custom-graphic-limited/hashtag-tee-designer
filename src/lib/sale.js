// The sale rule, bundled here so a cached /shared/cart-store.js can't hide a sale. It
// must match McgtCart.sale in cart-store.js and sale_price() in the square-checkout
// function (which is what charges): a sale is on while sale_price is set, below the
// regular price, and sale_ends_at (UK time; a date alone = end of that day; blank = no
// end) hasn't passed. An unreadable end = no sale.

const UK_DT = /^\s*(?:(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})\/(\d{1,2})\/(\d{4}))(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*$/

function londonOffsetMs(utcMs) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(utcMs))
    const v = Object.fromEntries(parts.map((p) => [p.type, Number(p.value)]))
    return Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - Math.floor(utcMs / 1000) * 1000
  } catch {
    return 0
  }
}

export function parseUkDateTime(s) {
  const m = UK_DT.exec(String(s ?? ''))
  if (!m) return null
  const [y, mo, d] = m[1] ? [+m[1], +m[2], +m[3]] : [+m[6], +m[5], +m[4]]
  const [h, mi, sec] = m[7] == null ? [23, 59, 59] : [+m[7], +m[8], +(m[9] || 0)]
  const guess = Date.UTC(y, mo - 1, d, h, mi, sec)
  return new Date(guess - londonOffsetMs(guess))
}

// -> { price, was, ends }
export function sale(regular, rawSale, rawEnds) {
  const none = { price: regular, was: null, ends: null }
  const s = Number(rawSale)
  if (String(rawSale ?? '').trim() === '' || !(s > 0) || !(s < regular)) return none
  let ends = null
  if (String(rawEnds ?? '').trim() !== '') {
    ends = parseUkDateTime(rawEnds)
    if (!ends || Date.now() >= ends.getTime()) return none
  }
  return { price: s, was: regular, ends }
}
