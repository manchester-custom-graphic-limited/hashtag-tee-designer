# Hashtag Tee designer

A four-step flow:

1. **Start** — a live sample design and "Start building your hashtags".
2. **Hashtags** — one big box; Enter adds a tag as a chip (× removes it), up to
   **10**, with a counter above. Duplicates are refused.
3. **Layout** — the tags are typeset into a **sphere** or a **square** (toggle at
   the top). Tap a tag to change its size, colour (main / grey / highlight /
   custom) or font; drag it onto another tag to move it, and the rest re-flow so the
   block re-forms the shape. "Auto-arrange" re-picks the order and colours.
4. **Preview** — black or white tee, front or back, then **Place Order**, which
   puts the print file in the existing mcgt.co.uk cart → Square checkout → Drive
   order folder, the same path Battle Tees take.

Intended URL: `mcgt.co.uk/special/hashtags/`. Shopify (mcgtltd.com) links or
URL-redirects there; it does not host a copy.

```bash
npm install
npm run dev        # http://localhost:5174 (Place Order is disabled outside mcgt.co.uk)
npm run build:mcgt # into ../mcgt/cloud-project-499409/firebase/public/special/hashtags
```

`build:mcgt` assumes the Firebase project sits beside the workbench, as the battle
tool's script does. That folder is not on this machine (see the workbench CLAUDE.md).

## How the typesetting works (`src/lib/layout.js`)

Tags stay in the customer's order and are split into rows; each row is scaled to
span the shape's width at that height (the full width for a square, the circle's
chord at the row's narrower edge for a sphere). With ≤10 tags there are ≤512 ways
to split the order, so every split is scored — fills the shape, sits centred, and
each tag's size follows its **Size** weight — and the best wins. `arrange()` picks a
starting order (short tags at the poles for a sphere) on entering the layout step,
on a shape change and on Auto-arrange; dragging overrides it.

Colours are **roles**, not fixed hexes (`src/lib/style.js`): main, grey and
highlight resolve per tee colour, so switching black ↔ white recolours sensibly. A
highlight that doesn't read on the tee is swapped for one that does.

## Price (2026-11-02)

Regular **£15.90**, both colours; **launch offer £13.90 for two weeks** from go-live.
The page shows an offer whenever a colour's Variants price is below the Products
price (regular struck through, "Launch offer" badge). To end the offer, set both
`hashtag_tee` Variants prices to 15.9 — no deploy needed.

## Before it can take orders — catalogue sheet

Add a `hashtag_tee` row to the **Products** tab (sizes, weight, price), with White
and Black rows in **Variants** if the prices differ. Until it exists (and `active`
isn't FALSE) the flow works but Place Order is blocked. The square-checkout function
reprices from the sheet, so that row is what is actually charged.

## The print file

- Transparent PNG, **250 × 250 mm** (the sphere's diameter / the square's side),
  300 DPI, written into the PNG (`pHYs`) so print software opens it at true size.
- Placement: centred, top edge **80 mm (front) / 60 mm (back)** below the collar
  seam (`PLACEMENT` in `src/config.js`).
- The whole design (tags, fonts, colours, shape, side, layout) is embedded as JSON
  in an `iTXt` chunk named `mcgt-design`, so an order can be rebuilt exactly.
  Read it with `exiftool -mcgt-design file.png`.
- Filename: `hashtag-tee-<shape>-<side>-<yyyymmddhhmm>.png`.

## Tee mock-ups

The preview uses real photos: `public/tees/black-front.png` and `white-front.png`,
blank tees from one studio shoot on Pixabay (user nattyjeff,
[1886001](https://pixabay.com/photos/blank-tshirt-male-fashion-top-1886001/) and
[1886013](https://pixabay.com/photos/blank-tshirt-male-fashion-top-1886013/)),
downloaded 2026-11-02. **Pixabay Content License**: free for commercial use, no
attribution required; don't redistribute the photos on their own.

No matching back-view photo exists, so `src/lib/photoMockup.js` derives the back
from the front: it fills the front neckline with fabric copied from lower on the
same photo and draws a back collar rib and neck label. The design is blended with
the photo's own shading (multiply on white, soft-light on black) so it reads as
printed. Collar and body positions per photo are measured constants in that file;
re-measure them if a photo is replaced.

## Fonts and licences

All self-hosted via `@fontsource`, lazy-loaded per font (CJK only downloads when
used, and only the unicode-range chunks the text needs). All are **SIL OFL 1.1**
except Permanent Marker (**Apache 2.0**); both allow commercial printing on goods.
The list, with each font's scripts, is `src/lib/fonts.js`.

## Files

```
src/App.jsx                    step state, fonts, ordering, Place Order
src/components/steps.jsx       the four steps
src/components/DesignCanvas.jsx  animated design, tap/drag/reorder
src/lib/layout.js              sphere/square typesetting + arrange()
src/lib/style.js               colour roles, contrast, auto-styling
src/lib/draw.js                draws tags (editor, preview and print share it)
src/lib/photoMockup.js         tee photos, derived back view, preview + thumbnail
src/lib/exportPrint.js         print PNG, pHYs/iTXt chunks
src/lib/fonts.js               font list, script detection, lazy loading
src/lib/text.js                hashtag cleaning
src/lib/cartBridge.js          catalogue sheet + window.McgtCart
src/config.js                  limits, print geometry, colours, product id
```

## Sample hashtags (start page)

`SAMPLE_TAGS` in `src/App.jsx`, chosen 2026-11-02 as slang people use *about
themselves*, weighted to the UK and Manchester:

| Tag | Who | Why |
|---|---|---|
| #MainCharacter | Gen Z | "seeing yourself as the protagonist" — a self-label by definition |
| #Delulu | Gen Z | top-24 most-searched slang 2026 (Unscramblerer); ~32k US searches Jan–Sep 2025 |
| #INFP | Gen Z / millennial | MBTI bio label; INFP is the most common result among online test-takers (13% on MyPersonality), as INFPs seek out self-discovery tests |
| #Scorpio | Gen Z / millennial | star sign as identity — 62% (Harris, 2024) to 80% (EduBirdie) of US Gen Z say they believe in astrology; Scorpio season is 23 Oct–21 Nov |
| #Buzzin | Manchester | Madchester-era Manc slang; a Manchester business name in Preply's 2024 study |
| #OurKid | Manchester | Manc for sibling/best mate, spread nationally by the Gallaghers |
| #Mint | Manchester / North | "very good"; the most common slang business name in Preply's study |
| #Manchester | — | home |

Also researched, not in the sample: #AuraFarming (#8 most-searched slang 2026), #Unc (#17), #ElderMillennial (owner's call, 2026-11-02).
Avoided: chud, bop, huzz, foid (insults/slurs), sigma (manosphere), skibidi (rated
most cringeworthy by 37% of UK adults, Preply 2026).
