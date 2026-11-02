// Draft save: on Place Order the print file goes to Drive (_Drafts/DRAFT_…) through the
// square-checkout function's /draft route, before the cart and payment. It lets the
// operator check exports and count who got as far as ordering. Best-effort: a failed or
// slow draft never blocks the order.

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

// Start loading reCAPTCHA early (preview step) so Place Order isn't kept waiting.
export function warmDraft() {
  siteConfig().then((cfg) => cfg.recaptchaSiteKey && loadCaptcha(cfg.recaptchaSiteKey))
}

async function captchaToken(siteKey) {
  if (!siteKey || !(await loadCaptcha(siteKey)) || !window.grecaptcha) return null
  return new Promise((resolve) => {
    window.grecaptcha.ready(() => window.grecaptcha.execute(siteKey, { action: 'draft' })
      .then(resolve, () => resolve(null)))
  })
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

// Resolves to the DRAFT_ id, or null on any failure.
export async function saveDraft({ blob, name, details }) {
  try {
    const cfg = await siteConfig()
    if (!cfg.squareCheckoutUrl) return null
    const [token, dataUrl] = await Promise.all([captchaToken(cfg.recaptchaSiteKey), blobToDataUrl(blob)])
    // text/plain keeps it a "simple" request (no CORS preflight), like the cart's /checkout.
    const r = await fetch(`${cfg.squareCheckoutUrl.replace(/\/$/, '')}/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token, upload: { name, mimeType: 'image/png', dataUrl }, details }),
    })
    const d = await r.json()
    return d.draftId || null
  } catch (err) {
    console.warn('draft save failed', err)
    return null
  }
}
