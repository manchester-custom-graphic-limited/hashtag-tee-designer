import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { StepIntro, StepLayout, StepPreview, StepTags } from './components/steps.jsx'
import { DEFAULT_FONT_ID, HIGHLIGHTS, MAX_TAGS, STORAGE_KEY } from './config.js'
import { addHashtagLineToCart, cartAvailable, fetchProduct } from './lib/cartBridge.js'
import { renderDesignCanvas, renderPrintPng } from './lib/exportPrint.js'
import { ensureFont, fontFor, fontSupports, getFont } from './lib/fonts.js'
import { arrange, layoutDesign, measureTags, shuffle } from './lib/layout.js'
import { autoRoles, highlightsFor, teeHex } from './lib/style.js'
import { mockupJpeg } from './lib/photoMockup.js'
import { tagLabel } from './lib/text.js'

const STEPS = [
  { id: 'intro', label: 'Start' },
  { id: 'tags', label: 'Hashtags' },
  { id: 'layout', label: 'Layout' },
  { id: 'preview', label: 'Preview' },
]

// Start-page sample: slang people use about themselves, UK and Manchester first,
// across Gen Z and millennials, plus the personality labels people put in bios
// (MBTI type, star sign). Research notes: README "Sample hashtags".
const SAMPLE_TAGS = ['MainCharacter', 'INFP', 'Scorpio', 'Buzzin', 'OurKid', 'Delulu', 'Mint', 'Manchester']
  .map((text, i) => ({ id: `s${i}`, text, weight: 1, fontId: fontFor(text, DEFAULT_FONT_ID) }))
const arrangeFor = (tags, shape) => arrange(tags, shape, measureTags(measureCtx, tags))

const newId = () => Math.random().toString(36).slice(2, 10)
const measureCtx = document.createElement('canvas').getContext('2d')

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved && Array.isArray(saved.tags)) return saved
  } catch { /* private mode, or nothing saved */ }
  return {}
}

function useLayout(tags, shape, fontsVersion) {
  return useMemo(
    () => layoutDesign(tags, shape, measureTags(measureCtx, tags)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tags.map((t) => `${t.id}:${t.text}:${t.fontId}:${t.weight}`).join('|'), shape, fontsVersion],
  )
}

export default function App() {
  const saved = useMemo(loadSaved, [])
  const [step, setStep] = useState(saved.tags?.length && saved.step ? saved.step : 'intro')
  const [tags, setTags] = useState(saved.tags || [])
  const [shape, setShape] = useState(saved.shape || 'sphere')
  const [teeColour, setTeeColour] = useState(saved.teeColour || 'Black')
  const [side, setSide] = useState(saved.side || 'front')
  const [highlight, setHighlight] = useState(saved.highlight || HIGHLIGHTS[0])
  const [globalFont, setGlobalFont] = useState(saved.globalFont || DEFAULT_FONT_ID)
  const [fontsVersion, setFontsVersion] = useState(0)
  const [product, setProduct] = useState(undefined) // undefined = loading
  const [size, setSize] = useState('')
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const hex = teeHex(teeColour)

  useEffect(() => { fetchProduct().then(setProduct) }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, tags, shape, teeColour, side, highlight, globalFont }))
    } catch { /* ignore */ }
  }, [step, tags, shape, teeColour, side, highlight, globalFont])

  // Load each font for the exact text it draws (CJK fonts arrive in chunks),
  // then re-measure and re-typeset.
  const drawn = step === 'intro' ? SAMPLE_TAGS : tags
  const fontKey = drawn.map((t) => `${t.fontId}:${t.text}`).join('|')
  useEffect(() => {
    let live = true
    Promise.all(drawn.map((t) => ensureFont(t.fontId, tagLabel(t)).catch(() => {})))
      .then(() => { if (live) setFontsVersion((v) => v + 1) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey])

  const layout = useLayout(tags, shape, fontsVersion)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sampleTags = useMemo(() => (step === 'intro' ? arrangeFor(SAMPLE_TAGS, 'sphere') : []), [step, fontsVersion])
  const sampleLayout = useLayout(sampleTags, 'sphere', fontsVersion)
  const sampleStyled = useMemo(() => autoRoles(sampleTags, sampleLayout.placed), [sampleTags, sampleLayout])

  // First visit to the layout step (or tags added since): style from the layout.
  useEffect(() => {
    if (step !== 'layout' || !tags.some((t) => !t.role) || !layout.placed.length) return
    const styled = autoRoles(tags, layout.placed)
    setTags((list) => list.map((t, i) => (t.role ? t : { ...t, role: styled[i]?.role || 'main' })))
  }, [step, tags, layout])

  // A highlight that doesn't read on the chosen tee is swapped for one that does.
  useEffect(() => {
    const ok = highlightsFor(teeColour)
    if (!ok.includes(highlight)) setHighlight(ok[0])
  }, [teeColour, highlight])

  useEffect(() => {
    if (product && !product.sizes.includes(size)) setSize(product.sizes.includes('L') ? 'L' : product.sizes[0])
  }, [product, size])

  const addTag = (text) => setTags((list) => (list.length >= MAX_TAGS ? list : [
    ...list, { id: newId(), text, weight: 1, fontId: fontFor(text, globalFont) },
  ]))
  const removeTag = (id) => setTags((list) => list.filter((t) => t.id !== id))
  const updateTag = useCallback((id, patch) => setTags((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t))), [])
  const reorder = useCallback((ids) => setTags((list) => ids.map((id) => list.find((t) => t.id === id))), [])

  const fontAll = (fontId) => {
    setGlobalFont(fontId)
    setTags((list) => list.map((t) => (fontSupports(getFont(fontId), t.text) ? { ...t, fontId } : t)))
  }
  // Shape changes re-pick the order for the shape; Shuffle varies it; dragging
  // is how the customer overrides it.
  const changeShape = (next) => { setShape(next); setTags((list) => arrangeFor(list, next)) }
  // Shuffle: a new order that still forms the shape, restyled from its sizes.
  // Custom colours, fonts and sizes the customer set are kept.
  const restyle = () => {
    const ordered = shuffle(tags, shape, measureTags(measureCtx, tags))
    const styled = autoRoles(ordered, layoutDesign(ordered, shape, measureTags(measureCtx, ordered)).placed)
    setTags(styled.map((t, i) => ({ ...t, color: ordered[i].color })))
  }
  const toLayout = () => {
    // New or changed tags since the last visit → arrange them for the shape.
    if (tags.some((t) => !t.role)) setTags((list) => arrangeFor(list, shape))
    go('layout')
  }

  const go = (id) => { setStep(id); window.scrollTo(0, 0) }

  const clearTags = () => {
    if (tags.length > 1 && !window.confirm(`Remove all ${tags.length} hashtags?`)) return
    setTags([])
  }

  // Back to the entrance with an empty design (the tee colour choice is kept).
  const startOver = () => {
    if (tags.length && !window.confirm('Start over? This clears your hashtags and layout.')) return
    setTags([])
    setShape('sphere')
    setSide('front')
    setHighlight(HIGHLIGHTS[0])
    setGlobalFont(DEFAULT_FONT_ID)
    setError('')
    go('intro')
  }

  const design = { tags, placed: layout.placed, shape, teeColour, highlight, side, fontsVersion }

  let blocker = null
  if (product === undefined) blocker = 'Loading prices…'
  else if (!product) blocker = 'The Hashtag Tee isn’t on sale yet — please check back soon.'
  else if (!cartAvailable()) blocker = 'Open this page from mcgt.co.uk to order.'

  const placeOrder = async () => {
    if (blocker || busy) return
    setBusy(true)
    setError('')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    try {
      await Promise.all(tags.map((t) => ensureFont(t.fontId, tagLabel(t))))
      const { blob } = await renderPrintPng(design)
      const thumb = await mockupJpeg({ teeColour, side, design: renderDesignCanvas(design, 600) })
      const label = tags.map(tagLabel).join(' ')
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
      await addHashtagLineToCart({
        product,
        colour: teeColour,
        blob,
        thumb,
        designLabel: `${label.length > 60 ? `${label.slice(0, 57)}…` : label} · ${shape} · ${side}`,
        uploadName: `hashtag-tee-${shape}-${side}-${stamp}.png`,
        size,
        qty: Math.max(1, Math.min(99, Math.round(qty) || 1)),
      })
      window.location.assign('/cart/')
    } catch (err) {
      console.error(err)
      setError('Could not place the order. Try again, or reload the page if it keeps happening.')
      setBusy(false)
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step)

  // The step tabs slide so the current one sits in the middle of the header.
  const navRef = useRef(null)
  const tabsRef = useRef(null)
  useLayoutEffect(() => {
    const nav = navRef.current
    const list = tabsRef.current
    if (!nav || !list) return
    const centre = () => {
      const on = list.querySelector('.on')
      if (!on) return
      const offset = nav.clientWidth / 2 - (on.offsetLeft + on.offsetWidth / 2)
      list.style.transform = `translateX(${offset}px)`
    }
    centre()
    window.addEventListener('resize', centre)
    return () => window.removeEventListener('resize', centre)
  }, [step])

  return (
    <div className="app">
      <header className="top">
        <a href="/" className="brand" aria-label="manchester.cgt home">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" width="36" height="36" />
          <span>manchester.cgt</span>
        </a>
        {step !== 'intro' && (
          <nav aria-label="Steps" className="steps-nav" ref={navRef}>
            <ol className="progress" ref={tabsRef}>
              {STEPS.slice(1).map((s, i) => {
                const here = i + 1 === stepIndex
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={here ? 'on' : i + 1 < stepIndex ? 'done' : ''}
                      aria-current={here ? 'step' : undefined}
                      disabled={s.id !== 'tags' && !tags.length}
                      onClick={() => (s.id === 'layout' ? toLayout() : go(s.id))}
                    >
                      {s.label}
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>
        )}
        <a href="/cart/" className="cart" aria-label="Cart">🛒</a>
      </header>

      <main>
        {step === 'intro' && (
          <StepIntro
            sample={{ tags: sampleStyled, layout: sampleLayout, teeColour: 'Black', teeHex: teeHex('Black'), highlight: HIGHLIGHTS[0] }}
            onStart={() => go('tags')}
          />
        )}
        {step === 'tags' && (
          <StepTags tags={tags} onAdd={addTag} onRemove={removeTag} onClear={clearTags} onNext={toLayout} />
        )}
        {step === 'layout' && (
          <StepLayout
            tags={tags} layout={layout} shape={shape} teeColour={teeColour} teeHex={hex} highlight={highlight}
            globalFont={globalFont} onShape={changeShape} onUpdateTag={updateTag} onReorder={reorder}
            onHighlight={setHighlight} onFontAll={fontAll} onRestyle={restyle}
            onBack={() => go('tags')} onNext={() => go('preview')}
          />
        )}
        {step === 'preview' && (
          <StepPreview
            design={design} teeColour={teeColour} side={side} onTee={setTeeColour} onSide={setSide}
            product={product} size={size} onSize={setSize} qty={qty} onQty={setQty}
            blocker={blocker} busy={busy} error={error} onOrder={placeOrder} onBack={() => go('layout')}
          />
        )}
      </main>

      <footer className="site-foot">
        {step !== 'intro' && (
          <button type="button" className="start-over" onClick={startOver}>↺ Start over</button>
        )}
        <a href="https://www.instagram.com/manchester.cgt" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="17.5" cy="6.5" r="1.3" fill="currentColor" />
          </svg>
          <span className="ig-lead">Follow us on Instagram</span> <b>@manchester.cgt</b>
        </a>
      </footer>
    </div>
  )
}
