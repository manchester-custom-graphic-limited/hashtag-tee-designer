// Fonts the customer can pick, all self-hosted via @fontsource and all licensed for
// commercial printing (SIL OFL 1.1, Permanent Marker is Apache 2.0). Each font
// declares the scripts it actually has glyphs for: the picker only offers fonts that
// cover every script in a tag, because a missing glyph would silently fall back to a
// system font in the canvas and print something the customer never saw.
//
// Loaders are lazy (CSS imported on first use) so the CJK fonts — several MB each —
// only download for people who type Chinese, Japanese or Korean.

export const FONTS = [
  { id: 'bebas', label: 'Bebas Neue', family: 'Bebas Neue', weight: 400, scripts: ['latin'],
    load: () => import('@fontsource/bebas-neue/400.css') },
  { id: 'anton', label: 'Anton', family: 'Anton', weight: 400, scripts: ['latin'],
    load: () => import('@fontsource/anton/400.css') },
  { id: 'archivo', label: 'Archivo Black', family: 'Archivo Black', weight: 400, scripts: ['latin'],
    load: () => import('@fontsource/archivo-black/400.css') },
  { id: 'marker', label: 'Permanent Marker', family: 'Permanent Marker', weight: 400, scripts: ['latin'],
    load: () => import('@fontsource/permanent-marker/400.css') },
  { id: 'pacifico', label: 'Pacifico', family: 'Pacifico', weight: 400, scripts: ['latin', 'cyrillic'],
    load: () => import('@fontsource/pacifico/400.css') },
  { id: 'bangers', label: 'Bangers', family: 'Bangers', weight: 400, scripts: ['latin'],
    load: () => import('@fontsource/bangers/400.css') },
  { id: 'pixel', label: 'Press Start 2P', family: 'Press Start 2P', weight: 400, scripts: ['latin', 'cyrillic', 'greek'],
    load: () => import('@fontsource/press-start-2p/400.css') },
  { id: 'techno', label: 'Chakra Petch', family: 'Chakra Petch', weight: 700, scripts: ['latin', 'thai'],
    load: () => import('@fontsource/chakra-petch/700.css') },
  { id: 'rubik', label: 'Rubik', family: 'Rubik', weight: 800, scripts: ['latin', 'cyrillic', 'hebrew', 'arabic'],
    load: () => import('@fontsource/rubik/800.css') },
  { id: 'noto', label: 'Noto Sans', family: 'Noto Sans', weight: 800, scripts: ['latin', 'cyrillic', 'greek', 'devanagari'],
    load: () => import('@fontsource/noto-sans/800.css') },
  { id: 'sc', label: 'Noto Sans 简体中文', family: 'Noto Sans SC', weight: 800, scripts: ['latin', 'han'],
    load: () => import('@fontsource/noto-sans-sc/800.css') },
  { id: 'tc', label: 'Noto Sans 繁體中文', family: 'Noto Sans TC', weight: 800, scripts: ['latin', 'han'],
    load: () => import('@fontsource/noto-sans-tc/800.css') },
  { id: 'jp', label: 'Noto Sans 日本語', family: 'Noto Sans JP', weight: 800, scripts: ['latin', 'han', 'kana', 'cyrillic'],
    load: () => import('@fontsource/noto-sans-jp/800.css') },
  { id: 'kr', label: 'Noto Sans 한국어', family: 'Noto Sans KR', weight: 800, scripts: ['latin', 'hangul'],
    load: () => import('@fontsource/noto-sans-kr/800.css') },
  { id: 'cairo', label: 'Cairo العربية', family: 'Cairo', weight: 800, scripts: ['latin', 'arabic'],
    load: () => import('@fontsource/cairo/800.css') },
  { id: 'hebrew', label: 'Noto Sans עברית', family: 'Noto Sans Hebrew', weight: 800, scripts: ['latin', 'hebrew'],
    load: () => import('@fontsource/noto-sans-hebrew/800.css') },
  { id: 'devanagari', label: 'Noto Sans हिन्दी', family: 'Noto Sans Devanagari', weight: 800, scripts: ['latin', 'devanagari'],
    load: () => import('@fontsource/noto-sans-devanagari/800.css') },
  { id: 'thai', label: 'Noto Sans ไทย', family: 'Noto Sans Thai', weight: 800, scripts: ['latin', 'thai'],
    load: () => import('@fontsource/noto-sans-thai/800.css') },
]

export function getFont(id) {
  return FONTS.find((f) => f.id === id) || FONTS[0]
}

const SCRIPT_TESTS = [
  ['cyrillic', /\p{Script=Cyrillic}/u],
  ['greek', /\p{Script=Greek}/u],
  ['arabic', /\p{Script=Arabic}/u],
  ['hebrew', /\p{Script=Hebrew}/u],
  ['devanagari', /\p{Script=Devanagari}/u],
  ['thai', /\p{Script=Thai}/u],
  ['han', /\p{Script=Han}/u],
  ['kana', /[\p{Script=Hiragana}\p{Script=Katakana}]/u],
  ['hangul', /\p{Script=Hangul}/u],
  ['latin', /\p{Script=Latin}/u],
]

// Scripts present in a piece of text (digits and `_` belong to every font).
export function scriptsOf(text) {
  return SCRIPT_TESTS.filter(([, re]) => re.test(text)).map(([s]) => s)
}

export function fontSupports(font, text) {
  return scriptsOf(text).every((s) => font.scripts.includes(s))
}

export function fontsFor(text) {
  return FONTS.filter((f) => fontSupports(f, text))
}

// `preferred` if it can draw the text, else the first font that can.
export function fontFor(text, preferred) {
  const f = getFont(preferred)
  return fontSupports(f, text) ? f.id : (fontsFor(text)[0] || f).id
}

export function isRtl(text) {
  return /[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(text)
}

export function fontCss(font, px) {
  return `${font.weight} ${px}px "${font.family}"`
}

// Loads the font CSS, then the glyphs for this exact text: the big fonts are split
// into unicode-range chunks and document.fonts.load fetches only the chunks the text
// needs. Resolves once the canvas can draw the text in the real face.
const cssLoaded = new Map()
export async function ensureFont(fontId, text) {
  const font = getFont(fontId)
  if (!cssLoaded.has(font.id)) cssLoaded.set(font.id, font.load())
  await cssLoaded.get(font.id)
  if (document.fonts) await document.fonts.load(fontCss(font, 64), text || 'A')
}
