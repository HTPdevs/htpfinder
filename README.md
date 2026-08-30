# HTPfinder

Finds local businesses that have no website, researches them from public
sources, and builds each one a demo site to open a sales conversation with.

A sub brand tool of `> HTPdevs`.

---

## Start here

New to this repo? Read this page, then run the quickstart below. It takes about
five minutes and needs no API key.

| I want to | Go to |
| --- | --- |
| Understand what this is and run it once | This page |
| Research a prospect and write their page | [docs/ENRICHMENT.md](docs/ENRICHMENT.md) |
| Know what every field in a prospect file means | [docs/PROSPECT-SCHEMA.md](docs/PROSPECT-SCHEMA.md) |
| Add a new trade, for example roofing or dental | [docs/ADDING-AN-INDUSTRY.md](docs/ADDING-AN-INDUSTRY.md) |
| Fix something that broke | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| Work on the CLI itself | [cli/README.md](cli/README.md) |
| Work on how the demo sites look | [demos/README.md](demos/README.md) |

---

## The idea

A large number of small local businesses have real customers, years of good
reviews, and no website. Their entire online presence is a Google listing and a
few directory pages they never look at.

That is a sales opening. Rather than cold pitching, we build the business a real
demo site first, using facts already public about them, and lead with it. The
conversation starts at "here is your site" instead of "would you like a site".

HTPfinder is the machinery for doing that repeatably across any trade.

## How it works

Three stages. The middle one is a person or an agent doing research, and that
is deliberate rather than a gap waiting to be filled.

```
  1. COLLECT                2. ENRICH                 3. BUILD
  ----------                ---------                 --------
  Google Places API   ->    research and judgment ->  demo site
  script                    agent, then validate      script

  Who has no website?       Who are they, really?     Show them.
```

**Collect** is cheap and mechanical. One API call per search phrase returns
name, phone, address, rating, review count, hours, and crucially whether the
business has a website at all. Everything failing the website check becomes a
prospect file.

**Enrich** is where the value is. Google Places gets you roughly sixty percent
of what a good page needs. The rest, years in business, crew size, owner name,
payment methods, the actual service list, lives on trade directories, and
pulling it together takes judgment. Deciding that two sources disagreeing about
an address means omitting the address, or that a perfect rating stranded on a
directory nobody visits is the real sales hook, is not something a scraper
produces. [docs/ENRICHMENT.md](docs/ENRICHMENT.md) is the procedure.

**Build** is mechanical again. A validated prospect file becomes the renderer's
data files, and the demo site exists.

## The rule that shapes everything

These pages carry a real business's name and get shown to that business's
owner. So:

> Every factual claim on a demo page traces to a public source URL recorded in
> the prospect file. A fact we cannot source is `null`, never a guess.

That is not a style preference, it is the thing that keeps this from being
spam. A page that invents a testimonial, a certification, or a years in
business number is worse than no page at all, because the owner will notice and
the conversation is over.

The layout degrades around missing facts rather than filling them in. No phone
number means the page drops the call action everywhere and leads with a form.
No public review text means the reviews section shows the real aggregate scores
with an honest note, never a written testimonial nobody left.

`htpfinder validate` enforces this mechanically. Read
[docs/PROSPECT-SCHEMA.md](docs/PROSPECT-SCHEMA.md) for exactly what it checks.

Every demo also carries a visible preview ribbon and a footer disclaimer saying
it is an unaffiliated concept preview. Leave both in place.

---

## Quickstart

Needs Node 20 or newer. No API key required for this walkthrough, which runs
against recorded results.

```bash
cd apps/htpfinder/cli
npm test                    # 26 tests, no dependencies to install

# What trades does this install know about?
node bin/htpfinder.js industries

# Find prospects. --fixture replays recorded Places results.
node bin/htpfinder.js collect lawn-care --fixture portland-lawn-care.places.json

# What did we get?
node bin/htpfinder.js list

# Look at one in detail, with its sources
node bin/htpfinder.js show key-concepts-landscape

# Get the research brief for the enrichment step
node bin/htpfinder.js packet key-concepts-landscape
```

The `collect` output ranks prospects by score and explains, per business, why
it thinks there is no website. Businesses that turn out to have a working site
are skipped and counted.

To run against live data instead, set a key and drop the fixture flag:

```bash
export GOOGLE_PLACES_API_KEY=...
node bin/htpfinder.js collect auto-repair --near "Portland, OR" --limit 50
```

Prospects collected from a fixture are marked as such and **cannot be built
into a page**. That is intentional: fixture ratings are placeholders, and
placeholder data must never reach a page carrying a real business name.

### Seeing a finished demo

Two demos are already researched and committed. To view one:

```bash
cd apps/htpfinder/demos
npm install
VITE_DEMO=key-concepts-landscape npm run dev
```

Both were generated from their prospect files, so `cat` either of
`data/prospects/*/prospect.json` to see exactly what a finished input looks
like before writing your own.

---

## Repository map

```
apps/htpfinder/
  README.md              this file
  docs/                  the guides linked at the top
  htpdevs-business-plan.md

  cli/                   the tool
    industries/          one file per trade, all vertical specific config
    fixtures/            recorded Places responses, for offline work
    src/commands/        one file per CLI command
    src/lib/             places, qualify, palettes, schema, validate
    test/

  data/prospects/<slug>/
    raw.json             verbatim Places response, never edited
    prospect.json        the contract: sourced facts plus written copy

  demos/                 the renderer
    src/data/<slug>/     GENERATED from prospect.json, do not hand edit
    src/components/      the shared page sections
```

The CLI writes plain files on disk, so a pass is inspectable with `cat` and a
bad one is undone with `rm`.

Real research is meant to land in Supabase instead. The schema is live and
documented in [supabase/README.md](supabase/README.md), with row level security
scoping every row to the user who collected it and a purge routine that can
honour a removal request. The CLI does not write to it yet, so today `data/` is
still the store and still test material.

`data/` is gitignored, and that is deliberate. A prospect file carries an owner
name, a direct phone and an address, and for a sole proprietor the last two are
routinely a personal cell and a home address. Add verbatim review quotes from
named third parties and the file is a targeting list built on personal data,
which is not something to make permanent in a history that might one day be
pushed somewhere public. Losing the between-passes diff is the price.

`raw.json` would be out anyway: it is the verbatim Places response, and Google's
terms restrict storing Places content.

## Two things that are easy to get wrong

**Do not hand edit anything in `demos/src/data/<slug>/`.** Those files are
generated. Edit the prospect file and run `htpfinder build <slug>` again.
Editing the generated file breaks the chain between a claim on the page and the
source it came from, which is the one thing this system exists to preserve.
Every generated file says so at the top.

**Do not copy another trade's industry profile without redoing the research.**
The directory list and the review thresholds are the two settings that quietly
make the tool bad at a trade if they are wrong. Twelve reviews is a healthy
lawn crew and a struggling auto shop.
[docs/ADDING-AN-INDUSTRY.md](docs/ADDING-AN-INDUSTRY.md) covers this.

## Status

Working: collect, the qualifier, scoring, the prospect schema and validator,
the palette system, build, and the renderer. Two industry profiles, lawn care
and auto repair. Two finished demos.

Not built yet: `htpfinder enrich` calling the Claude API directly so the middle
stage runs unattended, and the Google Sheets export. The schema and the packet
exist so that first one is a mechanical addition once output quality is proven.
Automating it before then risks discovering later that the pages read generic.

Demo sites stay local at localhost unless specifically decided otherwise.
