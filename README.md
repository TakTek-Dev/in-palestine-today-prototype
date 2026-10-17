# In Palestine Today: prototype

The visual identity and a working static prototype of [inpalestine.today](https://taktek-dev.github.io/in-palestine-today-prototype/), built by TakTek.

- **Identity book:** `index.html`. The mark, the ten lights, type, elements, motion, voice, photography, applications and downloadable files.
- **The site:** `home.html` (The Day), three editions (12 to 14 October 2026), 112 report and story pages, live coverage, the five desks, Stories, the olive-harvest thread, The Days, In pictures, Search, Who we are, Privacy, Terms and a 404.
- **Outside the site:** a share card per report, the newsletter (`email/`), an RSS feed (`feed.xml`), app icons and a web app manifest, and a social media kit (`assets/kit/`).

The reports are a real day in Palestine, rebuilt from public sources. Every report links to its source, and every figure names who counted it. The photographs are Wikimedia Commons archive images, credited in their captions and in `assets/img/photo/CREDITS.md`.

## How the identity works

The site keeps Palestine's clock (`Asia/Hebron`) and Palestine's light. `assets/js/sun.js` computes the sun over Jerusalem, and every ground and ink comes from it: the page chrome in the light of now, each part of the day in the light of its own hours. The full stop in the wordmark is the sun at its real altitude. It sinks halfway into the baseline at dusk, and the moon takes its place at night. `DESIGN.md` (kept out of the repository) and the identity book hold the rules.

## Building

The pages are generated. Never edit the HTML of a generated page by hand: change the data or the templates, then build.

```bash
python -I tools/build.py
```

Requirements: Python 3.10 or later, Node 22, and Google Chrome (for the images).

| What | Where |
|---|---|
| A day's running order (parts, slots, lead, photos) | `tools/editions/YYYY-MM-DD.json` |
| Live coverage of a day | `tools/live/*.json` |
| The reports themselves | `research/news*.json` (kept out of the repository) |
| Staff names, social accounts, contact addresses, publisher | `tools/site.json` |
| Shared page parts (head, masthead, footer) | `tools/tpl/parts/` |
| Styles | `assets/css/ipt.css` (system and homepage), `pages.css` (inner pages), `book.css` (identity book) |
| Scripts | `sun.js` (the sun), `ipt.js` (light, wordmark, dials, loader), `pages.js` (share, live, calendar), `search.js` |

After a build, draw the images with the site served locally (any static server on port 8157):

```bash
node --experimental-websocket tools/cards.mjs
```

```bash
node --experimental-websocket tools/stills.mjs
```

```bash
python -I tools/build.py
```

`cards.mjs` draws one 1200 × 630 share card per report into `assets/img/card/`. `stills.mjs` draws the app icons, the social kit and the newsletter's images. Building again points each report's `og:image` at its card.

When a CSS or JS file changes, raise `V` in `tools/build.py` so browsers fetch the new file. The identity book's links are versioned by hand.

## Before launch

`tools/site.json` holds sample details: staff names and desks, social accounts, contact addresses, the publisher's address and the Signal number. Replace each one with the real one. Also:

- Connect the newsletter form (`form[data-signup]` in `tools/tpl/parts/foot.html`) to the mailing service, and send `email/the-day-*.html` through it.
- Have the outlet's lawyer review `privacy.html` and `terms.html`.
- Remove `<meta name="robots" content="noindex">` from `tools/tpl/parts/head.html`, and set `BASE_URL` in `tools/build.py` to the real domain.
- The prototype is static. A CMS should keep the same data shapes: an edition is a day's running order, and a report carries its time, place, source, figures and photo.

## Credits

Typefaces: Piazzolla (Huerta Tipográfica) and Archivo (Omnibus-Type), both under the SIL Open Font License, licences in `assets/fonts/`. Photographs: see `assets/img/photo/CREDITS.md`.
