import { useEffect, useMemo, useRef, useState } from 'react'
import { MAX_TAGS, SHAPES, SIDES, TEE_COLOURS, WEIGHT_MAX, WEIGHT_MIN } from '../config.js'
import { renderDesignCanvas } from '../lib/exportPrint.js'
import { fontsFor } from '../lib/fonts.js'
import { autoRoles, highlightsFor, inkFor, ROLES } from '../lib/style.js'
import { composeMockup } from '../lib/photoMockup.js'
import { cleanTagText, tagLabel } from '../lib/text.js'
import DesignCanvas from './DesignCanvas.jsx'

// ---------------------------------------------------------------------------
// 1 · Entrance
// ---------------------------------------------------------------------------

export function StepIntro({ sample, onStart }) {
  return (
    <section className="step intro">
      <div className="intro-art" aria-hidden="true">
        <DesignCanvas {...sample} interactive={false} onSelect={() => {}} onReorder={() => {}} />
      </div>
      <div className="intro-copy">
        <h1>Your hashtags,<br />typeset on a tee.</h1>
        <p>Type up to {MAX_TAGS} hashtags - your name, your team, your city, your dog. We set them
          into a sphere or a square and print it on the front or back of a tee, in Manchester.</p>
        <button className="primary big" onClick={onStart}>Start building your hashtags</button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 2 · Hashtags
// ---------------------------------------------------------------------------

export function StepTags({ tags, layout, teeColour, teeHex, highlight, onAdd, onRemove, onClear, onNext }) {
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const input = useRef(null)
  const full = tags.length >= MAX_TAGS
  // Live typesetting: the tags in the order typed, coloured as the Layout step will start them.
  const styled = useMemo(() => autoRoles(tags, layout.placed), [tags, layout])

  useEffect(() => { input.current?.focus() }, [])

  const submit = (e) => {
    e.preventDefault()
    const text = cleanTagText(draft)
    if (!text || full) return
    if (tags.some((t) => t.text.toLowerCase() === text.toLowerCase())) {
      setNote(`#${text} is already in.`)
      return
    }
    onAdd(text)
    setDraft('')
    setNote('')
  }

  return (
    <section className="step tags-step">
      <form className="tag-entry" onSubmit={submit}>
        <p className="counter" aria-live="polite"><b>{tags.length}</b> / {MAX_TAGS} hashtags</p>
        <label className="big-input">
          <span aria-hidden="true">#</span>
          <input
            ref={input}
            value={draft}
            placeholder={full ? 'That’s all ten' : 'type a hashtag, press Enter'}
            onChange={(e) => { setDraft(cleanTagText(e.target.value)); setNote('') }}
            disabled={full}
            enterKeyHint="done"
            autoCapitalize="off"
            autoComplete="off"
            aria-label="Hashtag"
          />
        </label>
        <p className="hint">
          {note || 'Letters, numbers and underscore(_), any language. Spaces and punctuation drop out, like a real hashtag.'}
          {tags.length > 0 && <><br />Tap a hashtag in the sphere to remove it.</>}
          {tags.length > 0 && <><br />On the next page you can change sizes, colours and fonts, and drag hashtags around.</>}
        </p>
      </form>

      <div className={`tag-sphere${full ? ' full' : ''}${tags.length ? '' : ' empty'}`}>
        <DesignCanvas
          tags={styled} layout={layout} teeColour={teeColour} teeHex={teeHex} highlight={highlight}
          interactive={false} popIn onTap={onRemove} onSelect={() => {}} onReorder={() => {}}
        />
        {!tags.length && <p className="tag-sphere-empty">Your hashtags take shape here</p>}
      </div>
      {tags.length > 0 && (
        <button type="button" className="link clear-all" onClick={onClear}>Clear all</button>
      )}

      <footer className="step-bar">
        <span />
        <button className={`primary${full ? ' ready' : ''}`} disabled={!tags.length} onClick={onNext}>
          {full ? 'Full! Arrange them →' : 'Next →'}
        </button>
      </footer>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 3 · Layout
// ---------------------------------------------------------------------------

export function StepLayout({
  tags, layout, shape, teeColour, teeHex, highlight, globalFont,
  onShape, onUpdateTag, onReorder, onHighlight, onFontAll, onRestyle, onBack, onNext,
  lineSpacing, onLineSpacing,
}) {
  const [selectedId, setSelectedId] = useState(null)
  const selected = tags.find((t) => t.id === selectedId)
  const highlights = highlightsFor(teeColour)

  return (
    <section className="step layout-step">
      <div className="seg center" role="radiogroup" aria-label="Shape">
        {SHAPES.map((s) => (
          <button key={s.id} role="radio" aria-checked={shape === s.id} className={shape === s.id ? 'on' : ''}
            onClick={() => onShape(s.id)}>
            <i className={`shape-icon ${s.id}`} aria-hidden="true" /> {s.label}
          </button>
        ))}
      </div>

      <div className="design-wrap">
        <DesignCanvas
          tags={tags} layout={layout} teeColour={teeColour} teeHex={teeHex} highlight={highlight}
          selectedId={selectedId} onSelect={setSelectedId} onReorder={onReorder}
        />
      </div>

      <div className="panel">
        {selected ? (
          <>
            <div className="panel-head">
              <b>{tagLabel(selected)}</b>
              <button type="button" className="link" onClick={() => setSelectedId(null)}>Done</button>
            </div>
            <label className="fld">
              <span>Size</span>
              <input
                type="range" min={Math.log(WEIGHT_MIN)} max={Math.log(WEIGHT_MAX)} step="0.01"
                value={Math.log(selected.weight || 1)}
                onChange={(e) => onUpdateTag(selected.id, { weight: Math.exp(Number(e.target.value)) })}
              />
            </label>
            <div className="fld">
              <span>Colour</span>
              <div className="row">
                {ROLES.map((r) => {
                  const on = !selected.color && selected.role === r.id
                  return (
                    <button key={r.id} type="button" className={`pill${on ? ' on' : ''}`}
                      onClick={() => onUpdateTag(selected.id, { role: r.id, color: undefined })}>
                      <i className="dot" style={{ background: inkFor({ role: r.id }, teeColour, highlight) }} /> {r.label}
                    </button>
                  )
                })}
                <label className={`pill${selected.color ? ' on' : ''}`}>
                  <i className="dot rainbow" /> Custom
                  <input type="color" value={selected.color || inkFor(selected, teeColour, highlight)}
                    onChange={(e) => onUpdateTag(selected.id, { color: e.target.value })} />
                </label>
              </div>
            </div>
            <label className="fld">
              <span>Font</span>
              <select value={selected.fontId} onChange={(e) => onUpdateTag(selected.id, { fontId: e.target.value })}>
                {fontsFor(selected.text).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
          </>
        ) : (
          <>
            <p className="hint">Tap a hashtag to change its size, colour or font. Drag it to move it - the rest make room.</p>
            <div className="fld">
              <span>Highlight colour</span>
              <div className="swatches">
                {highlights.map((h) => (
                  <button key={h} type="button" className={`swatch${h === highlight ? ' on' : ''}`} style={{ background: h }}
                    aria-label={h} aria-pressed={h === highlight} onClick={() => onHighlight(h)} />
                ))}
              </div>
            </div>
            <div className="row">
              <label className="fld grow">
                <span>Font for all</span>
                <select value={globalFont} onChange={(e) => onFontAll(e.target.value)}>
                  {fontsFor(tags.map((t) => t.text).join('')).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </label>
              <button type="button" className="pill" onClick={onRestyle}>🔀 Shuffle</button>
            </div>
            <label className="fld">
              <span>Line spacing</span>
              <input type="range" min="0" max="4" step="0.1" value={lineSpacing}
                aria-valuetext={lineSpacing < 0.5 ? 'tight' : lineSpacing > 2 ? 'airy' : 'normal'}
                onChange={(e) => onLineSpacing(Number(e.target.value))} />
            </label>
          </>
        )}
      </div>

      <footer className="step-bar">
        <button className="ghost" onClick={onBack}>← Hashtags</button>
        <button className="primary" onClick={onNext}>Next →</button>
      </footer>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 4 · Preview + order
// ---------------------------------------------------------------------------

// Personalised tees are bought in ones and twos; bigger runs go through a bulk quote.
const QTY_CHOICES = [1, 2, 3, 4, 5]

export function StepPreview({
  design, teeColour, side, onTee, onSide, product, size, onSize, qty, onQty, blocker, busy, error, onOrder, onBack,
}) {
  // Re-composed on every change at the photo's resolution; the print file is
  // rendered separately at Place Order.
  const canvasRef = useRef(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let live = true
    composeMockup({ teeColour, side, design: renderDesignCanvas(design, 900) }).then((full) => {
      const c = canvasRef.current
      if (!live || !c) return
      c.width = full.width
      c.height = full.height
      c.getContext('2d').drawImage(full, 0, 0)
      setReady(true)
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teeColour, side, design.placed, design.tags, design.highlight, design.fontsVersion])
  const price = product?.priceFor(teeColour)
  const was = product?.wasFor(teeColour)

  return (
    <section className="step preview-step">
      <div className="row center">
        <div className="seg" role="radiogroup" aria-label="Tee colour">
          {TEE_COLOURS.map((c) => (
            <button key={c.id} role="radio" aria-checked={teeColour === c.id} className={teeColour === c.id ? 'on' : ''}
              onClick={() => onTee(c.id)}>
              <i className="dot" style={{ background: c.hex }} /> {c.id}
            </button>
          ))}
        </div>
        <div className="seg" role="radiogroup" aria-label="Print on">
          {SIDES.map((s) => (
            <button key={s.id} role="radio" aria-checked={side === s.id} className={side === s.id ? 'on' : ''}
              onClick={() => onSide(s.id)}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className={`mockup${ready ? '' : ' loading'}`}>
        <canvas ref={canvasRef} role="img" aria-label={`${teeColour} tee, design on the ${side}`} />
      </div>

      <div className="order">
        <div className="order-card">
          <div className="opt">
            <span className="opt-label" id="size-label">Size</span>
            <div className="choices" role="radiogroup" aria-labelledby="size-label">
              {(product?.sizes || []).map((s) => (
                <button key={s} role="radio" aria-checked={size === s} className={size === s ? 'on' : ''}
                  onClick={() => onSize(s)}>{s}</button>
              ))}
            </div>
          </div>
          <div className="opt">
            <span className="opt-label" id="qty-label">Quantity</span>
            <div className="choices" role="radiogroup" aria-labelledby="qty-label">
              {QTY_CHOICES.map((n) => (
                <button key={n} role="radio" aria-checked={qty === n} className={qty === n ? 'on' : ''}
                  onClick={() => onQty(n)}>{n}</button>
              ))}
            </div>
          </div>
          {price ? (
            <div className="price">
              <div className="price-each">
                {was && <span className="badge">Launch offer</span>}
                <span className="now">£{price.toFixed(2)}</span>
                {was && <s aria-label={`was £${was.toFixed(2)}`}>£{was.toFixed(2)}</s>}
                <span className="each">each</span>
              </div>
              {qty > 1 && (
                <div className="price-total">{qty} tees · <b>£{(price * qty).toFixed(2)}</b></div>
              )}
            </div>
          ) : null}
        </div>
        <button className="primary big" onClick={onOrder} disabled={Boolean(blocker) || busy}>
          {busy ? 'Placing order…' : 'Place Order'}
        </button>
        {blocker && <p className="hint">{blocker}</p>}
        {error && <p className="err">{error}</p>}
      </div>

      <footer className="step-bar">
        <button className="ghost" onClick={onBack}>← Layout</button>
        <span />
      </footer>
    </section>
  )
}
