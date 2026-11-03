# Hashtag Tee designer - `no-order` branch

**This branch is the free, standalone generator at https://hashtaggen.mcgt.co.uk**
(GitHub Pages, published by `.github/workflows/pages.yml` on every push to `no-order`).
It has no ordering: no cart, no catalogue sheet, no prices, no checkout, no design log,
and no mcgt.co.uk tracking scripts. Preview ends in **Download image** (the tee mock-up as
a 1080 px JPEG). `public/CNAME` sets the Pages domain.

`main` is the shop copy served at `mcgt.co.uk/special/hashtags/` (Firebase); don't
merge this branch into it. DNS: `hashtaggen` CNAME → `manchester-custom-graphic-limited.github.io`,
DNS-only, in `mcgt/dns/dnsconfig.js`.


A four-step flow:

1. **Start** — a live sample design and "Start building your hashtags".
2. **Hashtags** — one big box; Enter adds a tag as a chip (× removes it), up to
   **10**, with a counter above. Duplicates are refused.
3. **Layout** — the tags are typeset into a **sphere** or a **square** (toggle at
   the top). Tap a tag to change its size, colour (main / grey / highlight /
   custom) or font; drag it onto another tag to move it, and the rest re-flow so the
   block re-forms the shape. "Auto-arrange" re-picks the order and colours.
4. **Preview** — black or white tee, front or back, then **Download image**.

```bash
npm install
npm run dev     # http://localhost:5174
npm run build   # into dist/ (what Pages serves)
```

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
src/App.jsx                    step state, fonts, Download image
src/components/steps.jsx       the four steps
src/components/DesignCanvas.jsx  animated design, tap/drag/reorder
src/lib/layout.js              sphere/square typesetting + arrange()
src/lib/style.js               colour roles, contrast, auto-styling
src/lib/draw.js                draws tags (editor, preview and print share it)
src/lib/photoMockup.js         tee photos, derived back view, preview + thumbnail
src/lib/exportPrint.js         print PNG, pHYs/iTXt chunks
src/lib/fonts.js               font list, script detection, lazy loading
src/lib/text.js                hashtag cleaning
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
