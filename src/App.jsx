import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { StepIntro, StepLayout, StepPreview, StepTags } from './components/steps.jsx'
import { DEFAULT_FONT_ID, HIGHLIGHTS, MAX_TAGS, STORAGE_KEY } from './config.js'
import { renderDesignCanvas } from './lib/exportPrint.js'
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

// Funnel events through the site-wide /shared/track.js (consent-aware; absent in `vite dev`).
function track(event, data) {
  try { window.McgtTrack?.track(event, data) } catch { /* analytics must never break the page */ }
}

// Start-page sample: slang people use about themselves, UK and Manchester first,
// across Gen Z and millennials, plus the personality labels people put in bios
// (MBTI type, star sign). Research notes: README "Sample hashtags".
const SAMPLE_TAGS = ['MainCharacter', 'INFP', 'Scorpio', 'Buzzin', 'OurKid', 'Delulu', 'Mint', 'Manchester']
  .map((text, i) => ({ id: `s${i}`, text, weight: 1, fontId: fontFor(text, DEFAULT_FONT_ID) }))
const arrangeFor = (tags, shape, spacing = 1) => arrange(tags, shape, measureTags(measureCtx, tags), spacing)

const newId = () => Math.random().toString(36).slice(2, 10)
const measureCtx = document.createElement('canvas').getContext('2d')

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved && Array.isArray(saved.tags)) return saved
  } catch { /* private mode, or nothing saved */ }
  return {}
}

function useLayout(tags, shape, fontsVersion, spacing = 1) {
  return useMemo(
    () => layoutDesign(tags, shape, measureTags(measureCtx, tags), spacing),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tags.map((t) => `${t.id}:${t.text}:${t.fontId}:${t.weight}`).join('|'), shape, fontsVersion, spacing],
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
  const [lineSpacing, setLineSpacing] = useState(saved.lineSpacing ?? 1)
  // Once the customer drags or shuffles, their order is kept: new tags go on the end and
  // nothing re-arranges by itself. Until then, tags are arranged for the shape as typed.
  const [manualOrder, setManualOrder] = useState(saved.manualOrder ?? false)
  const [fontsVersion, setFontsVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const hex = teeHex(teeColour)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, tags, shape, teeColour, side, highlight, globalFont, lineSpacing, manualOrder }))
    } catch { /* ignore */ }
  }, [step, tags, shape, teeColour, side, highlight, globalFont, lineSpacing, manualOrder])

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

  const layout = useLayout(tags, shape, fontsVersion, lineSpacing)
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

  const started = useRef(false)
  const addTag = (text) => {
    if (!started.current) { started.current = true; track('design_start', { label: 'hashtag_tee' }) }
    addTagRaw(text)
  }
  // What the hashtag step shows is the order the Layout step starts from.
  const autoArrange = (list) => (manualOrder ? list : arrangeFor(list, shape, lineSpacing))
  const addTagRaw = (text) => setTags((list) => (list.length >= MAX_TAGS ? list : autoArrange([
    ...list, { id: newId(), text, weight: 1, fontId: fontFor(text, globalFont) },
  ])))
  const removeTag = (id) => setTags((list) => autoArrange(list.filter((t) => t.id !== id)))
  const updateTag = useCallback((id, patch) => setTags((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t))), [])
  const reorder = useCallback((ids) => {
    setManualOrder(true)
    setTags((list) => ids.map((id) => list.find((t) => t.id === id)))
  }, [])

  const fontAll = (fontId) => {
    setGlobalFont(fontId)
    setTags((list) => list.map((t) => (fontSupports(getFont(fontId), t.text) ? { ...t, fontId } : t)))
  }
  // Shape changes re-pick the order for the shape; Shuffle varies it; dragging
  // is how the customer overrides it.
  const changeShape = (next) => {
    setShape(next)
    setTags((list) => arrangeFor(list, next, lineSpacing))
    setManualOrder(false)
  }
  // Shuffle: a new order that still forms the shape, restyled from its sizes.
  // Custom colours, fonts and sizes the customer set are kept.
  const restyle = () => {
    const ordered = shuffle(tags, shape, measureTags(measureCtx, tags), Math.random, lineSpacing)
    const styled = autoRoles(ordered, layoutDesign(ordered, shape, measureTags(measureCtx, ordered), lineSpacing).placed)
    setTags(styled.map((t, i) => ({ ...t, color: ordered[i].color })))
    setManualOrder(true)
  }
  // No re-arranging here: the Layout step starts from exactly what the hashtag step showed.
  const toLayout = () => go('layout')

  const go = (id) => {
    if (id !== step && id !== 'intro') track('design_step', { label: `${id}:${tags.length}` })
    setStep(id)
    window.scrollTo(0, 0)
  }

  const clearTags = () => {
    if (tags.length > 1 && !window.confirm(`Remove all ${tags.length} hashtags?`)) return
    setTags([])
    setManualOrder(false)
  }

  // Back to the entrance with an empty design (the tee colour choice is kept).
  const startOver = () => {
    if (tags.length && !window.confirm('Start over? This clears your hashtags and layout.')) return
    setTags([])
    setShape('sphere')
    setSide('front')
    setHighlight(HIGHLIGHTS[0])
    setGlobalFont(DEFAULT_FONT_ID)
    setLineSpacing(1)
    setManualOrder(false)
    setError('')
    go('intro')
  }

  const design = { tags, placed: layout.placed, shape, teeColour, highlight, side, fontsVersion, lineSpacing }
  // Saves the tee mock-up (photo + design) as a JPEG.
  const downloadImage = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await Promise.all(tags.map((t) => ensureFont(t.fontId, tagLabel(t))))
      const url = await mockupJpeg({ teeColour, side, design: renderDesignCanvas(design, 1200) }, 1080)
      const a = document.createElement('a')
      a.href = url
      a.download = `hashtag-tee-${shape}-${side}.jpg`
      a.click()
    } catch (err) {
      console.error(err)
      setError('Could not save the image. Try again.')
    }
    setBusy(false)
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
        <a href="https://mcgt.co.uk/" className="brand" aria-label="manchester.cgt home">
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
      </header>

      <main>
        {step === 'intro' && (
          <StepIntro
            sample={{ tags: sampleStyled, layout: sampleLayout, teeColour: 'Black', teeHex: teeHex('Black'), highlight: HIGHLIGHTS[0] }}
            onStart={() => go('tags')}
          />
        )}
        {step === 'tags' && (
          <StepTags
            tags={tags} layout={layout} teeColour={teeColour} teeHex={hex} highlight={highlight}
            onAdd={addTag} onRemove={removeTag} onClear={clearTags} onNext={toLayout}
          />
        )}
        {step === 'layout' && (
          <StepLayout
            tags={tags} layout={layout} shape={shape} teeColour={teeColour} teeHex={hex} highlight={highlight}
            globalFont={globalFont} onShape={changeShape} onUpdateTag={updateTag} onReorder={reorder}
            onHighlight={setHighlight} onFontAll={fontAll} onRestyle={restyle}
            lineSpacing={lineSpacing} onLineSpacing={setLineSpacing}
            onBack={() => go('tags')} onNext={() => go('preview')}
          />
        )}
        {step === 'preview' && (
          <StepPreview
            design={design} teeColour={teeColour} side={side} onTee={setTeeColour} onSide={setSide}
            busy={busy} error={error} onDownload={downloadImage} onBack={() => go('layout')}
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
