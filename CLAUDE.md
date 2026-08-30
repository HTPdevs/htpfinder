# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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