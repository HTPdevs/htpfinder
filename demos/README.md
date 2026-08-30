# HTPfinder demo site renderer

**New here? Start at [../README.md](../README.md).** This page is the developer
reference for the renderer.

One Vite app, one shared layout, one folder per prospect. Adding a business
means writing two small files. It never means touching a component.

The point is speed on the far side of a yes. If a prospect takes the offer,
their demo is already a real Vite, React and Tailwind build, so nothing has to
be rewritten from scratch.

## Stack

Vite, React 19, Tailwind CSS 3, ShadCN (Radix primitives vendored into
`src/components/ui`), lucide-react.

No router. Each demo is a single long page with anchor navigation.

## Commands

```bash
npm install

# work on one demo
VITE_DEMO=key-concepts-landscape npm run dev

# production build for one demo, output to dist/<slug>/
VITE_DEMO=key-concepts-landscape npm run build

# every demo at once
npm run build:all
node scripts/build-all.mjs --single   # fully inlined, output to preview/<slug>/

# quality gates
node scripts/check-responsive.mjs     # 1440 / 1024 / 768 / 425 / 375 / 320
node scripts/check-copy.mjs           # no dashes, no banned words
```

`npm run dev` with no `VITE_DEMO` falls back to the first demo alphabetically.

## Section order

Fixed by CLAUDE.md and enforced in `src/App.jsx`:

1. Hero
2. CTA
3. About (story, stats, services, service area)
4. Reviews
5. Contact

## Adding a prospect

Do not hand author files here. Everything in `src/data/<slug>/` is **generated**
from a prospect file by the CLI:

```bash
cd ../cli
node bin/htpfinder.js build their-business-slug
```

Editing a generated file breaks the chain between a claim on the page and the
source it came from, and the next build overwrites it. Change
`data/prospects/<slug>/prospect.json` and rebuild instead. See
[docs/ENRICHMENT.md](../docs/ENRICHMENT.md).

`npm run new` still exists for scaffolding a demo by hand, but the CLI path is
the supported one.

## How the pieces fit

```
src/
  App.jsx                  layout, identical for every prospect
  data/site.js             single source of truth, re exports the active demo
  data/<slug>/site.js      all copy and facts for one business
  data/<slug>/theme.css    that business's palette
  components/              page sections
  components/ui/           vendored ShadCN primitives
```

`vite.config.js` reads `VITE_DEMO` and points the `@demo` alias at the right
folder, so `src/data/site.js` resolves to the active business and no component
ever imports a prospect by name. It also lifts `seo.title` and
`seo.description` into `index.html` at build time and writes output to
`dist/<slug>/`.

`base` is `'./'`, so a `dist/<slug>` folder can be dropped into any
subdirectory without a rebuild if one of these ever does go live.

## Sourcing rule

These pages carry a real business's name to a real business owner. Every
factual claim, meaning phone, rating, years in business, crew size, services
and payment methods, must trace to a public listing. Each `site.js` opens with
a comment recording what is sourced and what still needs confirming.

Where a fact is missing the layout degrades rather than inventing one. No phone
number means the header, hero and CTA band drop the call action and lead with
the form instead. No public review text means the reviews section shows the
real aggregate scores plus an honest placeholder, never a written testimonial
nobody actually left.

Every demo also carries a `PreviewRibbon` and a footer disclaimer stating it is
an unaffiliated concept preview. Leave both in place.

## Copy rules

From CLAUDE.md, enforced by `scripts/check-copy.mjs` against the built pages:

- No dashes of any kind in rendered text. Phone numbers are exempt, since the
  separator there is data formatting customers expect.
- None of the banned filler words: delve, tapestry, pivotal, realm, underscore,
  multifaceted, nuanced, harness, elevate, resonate.

## Design constraints

- Palettes draw on four seasonal families: autumn leaves, fields of flowers in
  spring, summer, and icy blue. Mix within a family so nothing clashes.
- Light palette only. These pages commit to one visual world, so there is no
  dark theme to maintain.
- Colors come from CSS variables defined in `src/styles/index.css` and
  overridden per demo. Nothing hardcodes a color.
- Common font families only. Poppins for display, Inter for body.
- Responsive at 1440, 1024, 768, 425, 375 and 320px. `check-responsive.mjs`
  fails the build on horizontal overflow, a JavaScript error, or a blank render.

## Deployment

Per CLAUDE.md these demos stay local at localhost unless specifically told
otherwise. `npm run build:all` exists so a demo can go live quickly if a
prospect says yes, not because any of them are deployed today.
