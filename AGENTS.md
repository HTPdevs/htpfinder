# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Rules for agent

- Do not use `-`, `--`, or any variation of dashes when writing text content
- Avoid `AI words` like `delve`, `tapestry`, `pivotal`, `realm`, `underscore`, `multifaceted`, `nuanced`, `harness`, `elevate`, `resonate`

## What this is

### The tool (htpfinder.tech)

Scraper that fills in blanks for businesses without websites, documents findings in Google Sheets, builds a demo site.
Stack: Vite + React 19 + React Router + Tailwind + ShadCN. Static build, Supabase/Postgres backend, deployed via Hostinger.

### Demo sites only

Single-page app at `/`: hero, CTA, about, reviews, contact, in that order.
Stack: Vite + React 19 + Tailwind + ShadCN, local at localhost unless told otherwise.

HTPfinder is a sub-brand tool of `> HTPdevs`: uses public data to reach prospects with a demo site, then upsells (AI chatbot, messaging, dashboard, full integration). Business/brand context: `htpdevs-business-plan.md`.

## Architecture

- **`src/data/site.js`** single source of truth for all copy (`NAV` + static strings). Edit the array here when adding content, not the component.
- **`src/styles/index.css`** custom CSS, fonts, animations.
- **Colors are flexible**: no way to know a business's real palette. Use combinations compatible with autumn leaves, spring flowers, summer, icy blue. Mix freely as long as colors don't clash.
- **Fonts**: common families only, Roboto/Poppins/Inter etc.
- **`src/hooks/`**: demo sites rarely need hooks, only add one when a real case demands it.
- **`src/components/ui/`** shared primitives (`Button`, `Card`, `Section`, ...). Check here before styling a new one-off element.
- **Routing** (`App.jsx`): scrolls to top on route change, smooth-scrolls to hash targets. Header nav and footer both read `NAV` from `site.js`, so section `id` props must match `NAV[].id`.

## Responsive requirement

All components, styles, and pages must work at 1440, 1024, 768, 425, 375, and 320px viewport widths — check these breakpoints when touching layout.

## Deployment

These are demo sites and will not be deployed, unless specifically told otherwise.

## Docs

Prospect pipeline (collect → enrich → render) documented in `docs/`. Read the relevant file before touching that stage:

- **`docs/ADDING-AN-INDUSTRY.md`** adding a new trade: `cli/industries/<id>.js` is the single file that drives collector, enrichment brief, validator, and renderer.
- **`docs/ENRICHMENT.md`** turning a collected prospect into `prospect.json`; hand this file to an agent doing prospect research.
- **`docs/PROSPECT-SCHEMA.md`** the `prospect.json` contract: facts are sourced, copy is written, missing data is `null` never guessed.
- **`docs/TROUBLESHOOTING.md`** known failure modes for collect/enrich/render stages, check before debugging from scratch.

## Imported Claude Cowork project instructions

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules for agent

- Do not use `-`, `--`, or any variation of dashes when writing text content
- Avoid `AI words` like `delve`, `tapestry`, `pivotal`, `realm`, `underscore`, `multifaceted`, `nuanced`, `harness`, `elevate`, `resonate`

## What this is

### The tool (htpfinder.tech)

Web scraper that fills in the blanks for businesses that do not have websites, creates logical documentation in Google Sheets, then builds a demo site. 
Tech stack: Vite + React 19 + React Router + Tailwind, ShadCN. Deployed as a static build with Supabase/Postgres backend and deployment through Hostinger. Will be built as a single page application/personal application 

### FOR DEMO SITES ONLY

Single-page application: `/` (single long page) that has  a hero, CTA, about, reviews, and contact **in that order**.
Tech stack: Vite + React 19  + Tailwind, ShadCN and kept local at localhost **unless otherwise specified**

HTPfinder is a sub-brand tool of `> HTPdevs` that uses public information and data to our own advantage and reaches out to prospects with a demo site + capabilities of upselling additional products (ai chatbot, messaging, dashboard, complete integration). Business model and brand-system context live in `htpdevs-business-plan.md` (parent business plan)

## Architecture

- **`src/data/site.js`** is the single source of truth for all page copy: `NAV` and all other static strings of text go here. Components map over these arrays rather than hardcoding content — when adding a new item to an existing section, edit the array here, not the component. 
- **`src/styles/index.css`** holds custom css , fonts, and animations
- **Color semantics are flexible**: You can assume each company uses a specific color palette for their business, but you have no way of knowing what colors they are drawn to or use. For the purposes of the demo sites, use color palettes that are compatible with `autumn leaves`, `fields of flowers in spring`, `summer`, and `icy blue colors`. Feel free to mix and match, so long as the colors are compatible and do not clash with one another for each site.
- **Type roles are absolute**:  Use common font-families - `Roboto`, `Poppins`, `Inter`, etc.
- **Hooks in `src/hooks/`** The demo sites should not have a purpose for hooks, unless a scenario arises where one of specifically needed.
- **`src/components/ui/`** holds the shared primitives (`Button`, `Card`, `Section`, etc.) that every page section composes — check here before adding new one-off styled elements.
- Routing (`App.jsx`) scrolls to top on route change and smooth-scrolls to in-page hash targets on navigation; the header nav and footer both read from `NAV` in `site.js` so links, ids, and section anchors stay in sync — section `id` props in each component must match `NAV[].id`

## Responsive requirement

All components, styles, and pages must work at 1440, 1024, 768, 425, 375, and 320px viewport widths — check these breakpoints when touching layout.

## Deployment

These are demo sites and will not be deployed, unless specifically told otherwise.
