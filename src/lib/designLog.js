// Design log: reaching Preview and pressing Place Order each add a row (tags, colour, size,
// qty, shape, side; no image) to the private Designer log sheet, through the square-checkout
// function's /design-event route. Best-effort: logging never blocks the customer.

let configP = null
function siteConfig() {
  if (!configP) configP = fetch('/order/config.json').then((r) => r.json()).catch(() => ({}))
  return configP
}

let captchaP = null
function loadCaptcha(siteKey) {
  if (!captchaP) {
    captchaP = new Promise((resolve) => {
      const s = document.createElement('script')
      s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`
      s.onload = () => resolve(true)
      s.onerror = () => resolve(false)
      document.head.appendChild(s)
    })
  }
  return captchaP
}

async function captchaToken(siteKey) {
  if (!siteKey || !(await loadCaptcha(siteKey)) || !window.grecaptcha) return null
  return new Promise((resolve) => {
    window.grecaptcha.ready(() => window.grecaptcha.execute(siteKey, { action: 'design' })
      .then(resolve, () => resolve(null)))
  })
}

// Resolves once the request is handed to the browser (keepalive lets it finish after the
// page navigates away), or after 3 s if the captcha is slow. Never rejects.
export function logDesignEvent(event, details) {
  const send = (async () => {
    try {
      const cfg = await siteConfig()
      if (!cfg.squareCheckoutUrl) return
      const token = await captchaToken(cfg.recaptchaSiteKey)
      // text/plain keeps it a "simple" request (no CORS preflight), like the cart's /checkout.
      fetch(`${cfg.squareCheckoutUrl.replace(/\/$/, '')}/design-event`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ token, event, details }),
      }).catch(() => {})
    } catch { /* logging must never break the page */ }
  })()
  return Promise.race([send, new Promise((r) => setTimeout(r, 3000))])
}
