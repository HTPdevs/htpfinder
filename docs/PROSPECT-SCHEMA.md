# prospect.json

The contract between research and rendering. One file per business, at
`data/prospects/<slug>/prospect.json`.

Two ideas carry the whole design.

**Facts are sourced, copy is written.** Anything asserted about a real business
lives under `facts` and carries a source URL. Editorial text we wrote lives
under `copy`. That split is what makes provenance checkable by a script rather
than promised in a comment.

**A missing fact is `null`, never a guess.** The renderer degrades around
nulls. Missing data produces a page that says less, never a page that says
something untrue.

---

## Top level

| Field | Type | Notes |
| --- | --- | --- |
| `schemaVersion` | number | Currently `1`. The validator rejects anything else. |
| `slug` | string | Directory name, and the demo's build target. |
| `industry` | string | Must match an id in `cli/industries/`. |
| `status` | string | `collected`, `enriched`, `built`, `contacted`, `rejected`. |
| `provenance` | string | `google-places`, `fixture`, or `manual-research`. |
| `collectedAt` | ISO date | Set by collect. |
| `enrichedAt` | ISO date or null | Set when research finishes. |
| `score` | object or null | `{ total, reasons[] }`, written by collect. |
| `website` | object or null | The no website determination and why. |
| `facts` | object | Sourced claims. See below. |
| `unresolved` | string[] | Conflicts and gaps. Talking points, not problems. |
| `copy` | object or null | Page text. Absent until enrichment. |
| `design` | object or null | `{ paletteId, motif, mark }`. Build fills it in. |

`provenance: "fixture"` blocks the build entirely. Fixture ratings are
placeholders and must never reach a page carrying a real business name.

---

## facts

Every scalar fact is either `null` or `{ value, source, ...extra }` where
`source` is an `http` or `https` URL. Anything else fails validation.

```json
"phone": { "value": "(503) 839-8283", "source": "https://www.bbb.org/..." },
"crewSize": { "value": 5, "approx": true, "source": "https://www.bbb.org/..." },
"address": null
```

| Field | Value type | Filled by | Notes |
| --- | --- | --- | --- |
| `name` | string | collect | Required. The only mandatory fact. |
| `phone` | string | collect | Null drops the call action across the whole page. |
| `address` | string | collect | Null when sources conflict. |
| `hours` | string | collect | Semicolon joined. |
| `location` | `{lat,lng}` | collect | Raw, not a sourced fact object. |
| `placesTypes` | string[] | collect | Raw Places categories. |
| `ratings` | array | both | See below. |
| `reviewQuotes` | array | both | See below. Highest risk field in the file. |
| `services` | array | enrich | See below. |
| `yearsInBusiness` | number | enrich | Use `approx: true` for ranges. |
| `crewSize` | number | enrich | |
| `ownerName` | string | enrich | Unlocks honest "owner operated" copy. |
| `paymentMethods` | string[] | enrich | Informal ones like Venmo are a real selling point. |
| `freeEstimates` | boolean | enrich | |
| `languages` | string[] | enrich | |
| `certifications` | string[] | enrich | Never infer. Listed or null. |
| `serviceArea` | string[] | enrich | Add `"confirmed": false` when inferred. |

### ratings

```json
"ratings": [
  { "source": "Angi", "url": "https://...", "score": 4.8, "count": 12 }
]
```

`url` must be a real URL, `score` between 0 and 5, `count` a non negative
integer. The first entry becomes the hero badge. Use `[]` when none were found.

### reviewQuotes

```json
"reviewQuotes": [
  {
    "text": "From our initial phone call, to his estimate, to arriving on time, to completion of work = 10/10.",
    "author": "Rori Harris-Killough",
    "source": "Google",
    "url": "https://maps.google.com/..."
  }
]
```

**Verbatim or absent.** Copy exact words. Never paraphrase, never compose
something in the spirit of the reviews. A quote without a URL fails validation,
because a quote that cannot be verified should not be on the page.

Empty is completely fine. The reviews section renders real aggregate scores
plus an honest placeholder, which reads well and is arguably a better sales
argument.

### services

```json
"services": [
  { "key": "irrigation", "blurb": "Broken heads and leaks tracked down...", "source": "https://..." }
]
```

`key` must exist in the industry profile's `serviceTaxonomy`, which is how the
page gets a matching icon and consistent wording across prospects. `blurb` is
yours to write. An empty array is a warning, not an error, but produces a thin
page.

---

## unresolved

Free text, one entry per conflict or gap.

```json
"unresolved": [
  "BBB lists 6270 NW Oats Ter (97229) while Angi lists a Bridle Hills Dr address (97222). Address omitted until resolved.",
  "Sources give years in business as 15 to 17. The conservative 15 is used."
]
```

This is the most underrated field in the file. It never renders, and it is the
best call preparation you will have. Two of a business's own listings
disagreeing is worth knowing before you dial.

---

## copy

Written during enrichment. Sections map to the page in order.

| Section | Contains |
| --- | --- |
| `seo` | `title`, `description`, `themeColor` |
| `nav` | `[{ id, label }]`, ids must match section ids |
| `hero` | `eyebrow`, `headline`, `subhead`, `footnote`, `chips[]` |
| `cta` | `primary`, `secondary`, `eyebrow`, `headline`, `body`, `points[]` |
| `about` | `eyebrow`, `headline`, `body`, `points[]`, `stats[]`, `servicesHeadline`, `areaHeadline`, `areaBody` |
| `reviews` | `eyebrow`, `headline`, `body`, `placeholder` |
| `contact` | `eyebrow`, `headline`, `body`, `noPhoneNote`, `formPlaceholder`, `formButton` |
| `footer` | `shortName`, `tagline`, `legalNote`, `sourceNote` |

Ratings, review items, the service list and the service area are **not** in
`copy`. They come from `facts` at build time, which is what keeps the page and
its sources in step.

`footer.sourceNote` is the disclaimer stating this is an unaffiliated concept
preview. It is required and should stay.

---

## What the validator checks

```bash
node bin/htpfinder.js validate <slug>            # strict, ready to build
node bin/htpfinder.js validate --stage collect   # allows missing copy
```

Errors block a build. Warnings do not, but usually should be fixed.

**Errors**

- Wrong `schemaVersion`, missing `slug`, or an `industry` with no profile
- A fact present but with no valid source URL, or a source with no value
- Missing `facts.name`
- A rating without a URL, or with a score outside 0 to 5
- A review quote without text, source platform, or URL
- A service key not in the industry's taxonomy, or without a source
- A palette that does not exist, or from a family the industry disallows
- Any dash in copy, phone numbers excepted
- Any banned filler word in copy
- Missing copy sections at build stage
- `provenance: "fixture"` at build stage

**Warnings**

- A review quote with no recorded author
- No services found
- No phone on file
- Copy that outruns the facts: quoted text with no sourced quote, mentions of
  years in business, certifications, or owner operation with nothing behind
  them

That last group is a heuristic rather than a proof. It catches the specific
failure this system exists to prevent, but it cannot catch every invention.
Reading the finished page as the owner would is still the real check.
