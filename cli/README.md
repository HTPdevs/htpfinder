# htpfinder CLI

Local tool that finds businesses without a website, turns public data into a
validated prospect file, and builds a demo site from it.

Industry agnostic. Lawn care and auto repair ship as profiles; a new trade is a
data file, not a code change.

**New here? Start at [../README.md](../README.md)**, which covers what this is
for and has a quickstart. This page is the developer reference for the CLI
itself.

Related: [enrichment procedure](../docs/ENRICHMENT.md) ·
[prospect schema](../docs/PROSPECT-SCHEMA.md) ·
[adding an industry](../docs/ADDING-AN-INDUSTRY.md) ·
[troubleshooting](../docs/TROUBLESHOOTING.md)

## Install

```bash
cd apps/htpfinder/cli
npm link            # optional, puts `htpfinder` on your PATH
export GOOGLE_PLACES_API_KEY=...
```

Zero runtime dependencies. Node 20 or newer.

Without an API key everything except live collection still works, using the
recorded fixtures in `fixtures/`.

## The pipeline

Three stages. The middle one is an agent, and that is deliberate: deciding that
two sources disagreeing about an address means omitting it, or that a perfect
rating stranded on a directory is the actual sales hook, is judgment rather
than extraction.

```
collect            enrich                  build
Places API   ->    agent research    ->    site.js + theme.css
(script)           (packet + validate)     (script)
```

```bash
htpfinder industries
htpfinder profile "roofing"                  # brief for a trade not covered yet
htpfinder collect lawn-care --near "Portland, OR" --limit 50
htpfinder list --min-score 60
htpfinder packet key-concepts-landscape      # brief for the research step
#   ... agent fills in data/prospects/<slug>/prospect.json ...
htpfinder validate key-concepts-landscape
htpfinder build key-concepts-landscape --run
```

Run any command with `--help` for its options.

## Where things live

```
cli/
  industries/<id>.js        everything vertical specific
  fixtures/                 recorded Places responses for offline work
  src/lib/                  places, qualify, palettes, schema, validate
  src/commands/             one file per command
data/prospects/<slug>/
  raw.json                  verbatim Places response
  prospect.json             the contract, facts plus copy
demos/                      the renderer, reads src/data/<slug>/
```

Prospect state is plain files on disk. No database, so a pass is inspectable
with `cat` and a bad one is undone with `rm`.

`data/` is gitignored. Prospect files carry owner names, direct phones and
addresses that for a sole proprietor are often personal, plus review quotes from
named third parties, and git history makes that permanent. Re running `collect`
is the intended way to get a machine back to a known state, not `git checkout`.

## The prospect contract

Facts are sourced, copy is written, and a missing fact is `null` rather than a
guess. Full field reference in
[docs/PROSPECT-SCHEMA.md](../docs/PROSPECT-SCHEMA.md).

## What the validator enforces

Run `htpfinder validate` before any build. Every rule and its rationale is
listed in [docs/PROSPECT-SCHEMA.md](../docs/PROSPECT-SCHEMA.md#what-the-validator-checks).

## Adding an industry

```bash
htpfinder profile "roofing"             # the research brief
htpfinder profile "roofing" --scaffold  # and a file to fill in
#   ... research fills in industries/roofing.js ...
htpfinder industries                    # validates and audits it
```

Same shape as the prospect pipeline, one level up: a brief goes out, research
comes back as a file, the file gets checked.

Research three businesses in the trade before writing the profile. The directory
list and the review thresholds cannot be derived from a desk, and getting them
wrong makes the tool quietly bad at that trade. Recording those three in the
profile's `research` block is what lets `htpfinder industries` report a
directory nobody verified, rather than taking the list on faith. Full guide in
[docs/ADDING-AN-INDUSTRY.md](../docs/ADDING-AN-INDUSTRY.md).

## On the no website check

The naive check, "Places returned no `websiteUri`", misses most real prospects
and adds false ones. From the Portland pass by hand: several businesses listed
a directory mill domain, one listed a domain belonging to a same named company
in another state, several pointed at a Facebook page, and two pointed at
domains that no longer resolved.

So `qualify.js` has tiers: no URL at all, a URL on a known aggregator or social
domain, and a URL that fails a fetch. A 401, 403 or 429 counts as **live**,
because plenty of real small business sites sit behind a filter that rejects an
unfamiliar user agent, and counting those as "no website" fills the list with
businesses that already have one. Inconclusive checks are flagged rather than
assumed.

## Testing

```bash
npm test
```

Covers the qualifier tiers, the scoring, the validator rules, palette
distribution, and a cross check that every icon a profile names actually exists
in the renderer.

## Not built yet

`htpfinder enrich` calling the Claude API directly, so the middle stage runs
unattended. The schema and the packet exist precisely so that swap is
mechanical when the output quality is proven. Automating it first risks
discovering later that the pages read generic.
