// ---------------------------------------------------------------------------
// Design limits
// ---------------------------------------------------------------------------

export const MAX_TAGS = 10
export const TAG_MAX_CHARS = 24 // excluding the leading #

// Relative size a customer can give one tag (1 = default). The layout honours it
// as closely as the shape allows.
export const WEIGHT_MIN = 0.4
export const WEIGHT_MAX = 2.5

export const SHAPES = [
  { id: 'sphere', label: 'Sphere' },
  { id: 'square', label: 'Square' },
]

export const DEFAULT_FONT_ID = 'anton' // condensed faces pack best into a block

// ---------------------------------------------------------------------------
// Print geometry
// ---------------------------------------------------------------------------

// The design prints as a DESIGN_MM square (the sphere's diameter / the square's
// side) on one side of the tee, centred, its top edge PLACEMENT[side] below the
// collar seam.
export const DESIGN_MM = 250
export const PLACEMENT = {
  front: { topBelowCollarMm: 80 },
  back: { topBelowCollarMm: 60 },
}

// Print DPI, best first. 250 mm at 300 DPI is ~8.7 MP, inside what phones will
// allocate; the ladder is a safety net, not the expected path.
export const DPI_LADDER = [300, 240, 200]

// ---------------------------------------------------------------------------
// Tee and ink colours
// ---------------------------------------------------------------------------

export const TEE_COLOURS = [
  { id: 'Black', hex: '#161616' },
  { id: 'White', hex: '#f5f5f2' },
]

export const SIDES = [
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
]

export const HIGHLIGHTS = ['#ffd600', '#ff7a00', '#e53935', '#ff4fa3', '#2bb24c', '#1e88e5', '#8e24aa']

// ---------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------

export const STORAGE_KEY = 'mcgt-hashtag-design-v2'
