# Enrichment

How to turn a collected prospect into a finished `prospect.json`.

This is stage two of three, and it is the one that decides whether a demo reads
like it is about a specific business or about a category. Budget twenty to
forty minutes per prospect the first few times.

This document doubles as the brief you hand an agent. If you are asking Claude
to do the research, point it at this file and at `htpfinder packet <slug>`.

---

## The automated floor

```bash
node bin/htpfinder.js enrich <slug>
node bin/htpfinder.js enrich --all     # every prospect with no copy yet
```

This writes all seven copy sections straight from the facts the collector
already gathered, so a sweep of forty businesses becomes forty buildable
prospects without an agent touching one of them. It invents nothing: every
sentence is assembled from a fact that is present and sourced, and a fact that
is missing means the sentence is not written at all.

What it cannot do is the part below. It has no services, no years in business,
no owner name and no directory listings to work from, so its pages say true
things about a business rather than the specific things that get a call
returned. Use it to get a whole sweep standing up, then do the research pass
properly on the prospects worth a call.

`enrich` refuses to overwrite copy that already exists unless you pass
`--force`, so it can never quietly destroy a research pass. It also skips
prospects collected from a fixture, since those can never be built.

---

## Before you start

```bash
node bin/htpfinder.js show <slug>      # what we already know
node bin/htpfinder.js packet <slug>    # what is missing, and where to look
```

The packet lists the trade's directories in the order they paid off during real
research, the service vocabulary you are allowed to use, and the palettes still
free. Work from it rather than guessing.

Open `data/prospects/<slug>/prospect.json` in an editor. That file is what you
are filling in.

---

## The one rule

> Every factual claim carries a source URL. A fact you cannot source is `null`.

There is no third option. Not "probably", not "seems like", not a reasonable
inference from the business name. If a listing does not say it, it is `null`,
and the page will handle the absence gracefully.

This matters because the finished page carries a real business's name and gets
sent to that business's owner. An invented detail is not a small cosmetic
problem, it ends the conversation and damages the brand doing the outreach.

Two corollaries worth stating separately, because they are the ones people
break first:

**Review quotes are verbatim or absent.** Never paraphrase a review into
something tidier. Never compose a testimonial in the spirit of the reviews. If
you cannot copy exact words with an author name and a URL, leave
`reviewQuotes` empty. The reviews section renders the real aggregate scores
with an honest note, and that reads fine.

**Conflicts are recorded, not resolved.** When two sources disagree, put both
in `unresolved` and leave the field `null`. Those entries become talking points
on the call. Silently picking one is how a page ends up asserting an address
the owner moved out of two years ago.

---

## The procedure

### 1. Sweep the trade directories

Take the domains from the packet in order. For each, search for the business
name plus the city.

```
"Key Concepts Landscape" Portland site:bbb.org
"Key Concepts Landscape" Portland homeguide
```

You are hunting for facts Places does not carry: years in business, crew size,
owner name, payment methods, free estimates, licensing, languages, the real
service list, and any review text.

Stop when you have swept the list or run out of new information. Two or three
good listings usually beats ten thin ones.

### 2. Watch for the wrong business

This is the most common way to poison a prospect file. Small trade businesses
share names constantly.

During the Portland pass, "Kevin's Landscaping" returned a clean professional
site at the top of search that belonged to a company in Saline, Michigan. It
would have been easy to fill half the file from it.

Before recording anything from a listing, confirm at least one of: the phone
number matches, the address is in the right metro, or the listing explicitly
names the right city. If none of those check out, it is a different company.

### 3. Record the facts

Fill `facts` in `prospect.json`. Every entry is either `null` or an object with
a `value` and a `source`.

```json
"yearsInBusiness": { "value": 15, "approx": true, "source": "https://www.bbb.org/..." },
"ownerName":       { "value": "Errin Jacobs", "source": "https://www.bbb.org/..." },
"crewSize":        null
```

Use `"approx": true` when a listing says "about five" or gives a range. When
sources give a range, take the conservative end and note it in `unresolved`.

Services use the keys from the packet, never invented ones. Each carries its
own source and a one line blurb you write:

```json
"services": [
  {
    "key": "irrigation",
    "blurb": "Broken heads, dead zones and leaks tracked down and fixed before the water bill notices.",
    "source": "https://www.angi.com/..."
  }
]
```

The `key` proves the service is real and in the trade's vocabulary. The `blurb`
is yours to write, and it should describe the job the way a customer
experiences it rather than the way a contractor lists it.

See [PROSPECT-SCHEMA.md](PROSPECT-SCHEMA.md) for every field.

### 4. Find the angle

Before writing a word of copy, answer one question: **what is the single most
interesting true thing about this business?**

It is almost never the service list. Real examples from the Portland pass:

- Key Concepts Landscape has run for fifteen plus years with a five person crew
  and the owner still on the job. The angle is accountability: the person who
  quotes the work is the person who does it.
- New Green Landscaping has twenty seven years and a perfect rating that lives
  on a directory page nobody visits. The angle is the waste of that, which is
  also, conveniently, the pitch.

If the best you can find is "they do lawn care and have good reviews", either
research is incomplete or this prospect is weak. Both are worth knowing before
you write.

### 5. Write the copy

Fill `copy`. The sections map to the page in order: `seo`, `hero`, `cta`,
`about`, `reviews`, `contact`, `footer`.

Write for the customer, not the business owner. The reader is somebody deciding
who to call, and they care about showing up when promised, a price that does
not move, and not having to chase anybody.

**Rules the validator enforces**

- No dashes of any kind. Not hyphens, not em dashes. Restructure the sentence.
  Phone numbers are the only exemption.
- No banned filler: delve, tapestry, pivotal, realm, underscore, multifaceted,
  nuanced, harness, elevate, resonate.
- Copy cannot outrun the facts. Saying "owner operated" with no sourced owner
  name raises a warning, as does mentioning years in business or certifications
  with nothing behind them.

**Rules the validator cannot check, which matter just as much**

- Every stat in `about.stats` must correspond to a recorded fact. Four stats
  that all restate the rating is padding.
- The `reviews.placeholder` text should say plainly that reviews would appear
  there on a live site and that nothing was invented. It is doing double duty
  as honesty and as a sales point.
- Do not claim capabilities the business has not advertised. Speed, warranties,
  availability and pricing are the tempting ones.

### 6. Pick a palette

The packet lists free palette ids. Take one from a family no neighbouring
prospect is using. `htpfinder build` assigns one automatically if you skip
this, and it already spreads across families, so this step is optional unless a
trade suggests a particular season.

### 7. Validate and iterate

```bash
node bin/htpfinder.js validate <slug>
```

Errors block the build. Warnings are advisory but usually worth fixing: a
warning that copy claims something unsourced is the validator catching exactly
the failure this whole system exists to prevent.

Then build:

```bash
node bin/htpfinder.js build <slug> --run
cd ../demos && VITE_DEMO=<slug> npm run dev
```

Read the finished page as the business owner would. The question is not "is
this good marketing copy", it is "would the owner recognise their business in
this, and would anything on the page make them think we made it up".

---

## Worked example: Key Concepts Landscape

The full trail for one prospect, from collected to built.

**After collect.** Places gave a name, the phone number, a Portland address,
and the fact that no website was listed. Score 85, which is high, driven by no
website at all plus a usable phone number.

**Directory sweep.** BBB carried the owner name, roughly fifteen years in
business, a sole proprietorship structure, and about five employees. Angi
carried the service list, the free estimates claim, and a 4.8 rating over
twelve reviews. HomeGuide had a thin profile with one review.

**A conflict surfaced.** BBB listed an address on NW Oats Terrace in 97229.
Angi listed a Bridle Hills Drive address in 97222. Those are different parts of
the metro, not a typo.

Resolution: `address` set to `null`, and this went in `unresolved`:

```json
"unresolved": [
  "BBB lists 6270 NW Oats Ter (97229) while Angi lists a Bridle Hills Dr address (97222). Address omitted from the page until resolved."
]
```

The page simply does not show an address. Nobody notices, and there is now a
concrete question to ask on the call.

**A second conflict, handled differently.** Sources gave years in business as
anywhere from fifteen to seventeen. Both are plausible and neither is wrong, so
the conservative fifteen was recorded with `approx: true` and the range noted
in `unresolved`. Copy says "more than fifteen years", which is true under
either source.

**A judgment call the validator cannot make.** The service area chips list
neighbourhoods near the BBB zip. Only "Portland metro" is actually sourced.
Rather than dropping the section or pretending, the inference is recorded in
`unresolved` as something to confirm, and the source on the field points at the
listing the zip came from.

**No review text was available.** Angi shows scores but the review bodies were
not retrievable, so `reviewQuotes` stayed empty. The reviews section renders
the two real aggregate scores plus a note saying reviews would appear there on
a live site and nothing has been invented. That section is now arguably a
better sales argument than a testimonial would have been.

**The angle.** Fifteen years, five people, owner on the job. Everything in the
copy points at accountability, and the headline landed on "The whole yard,
handled by one crew."

**Result.** Validates clean, builds, and every claim on the finished page can
be traced back to a listing URL in the prospect file.

Read `data/prospects/key-concepts-landscape/prospect.json` alongside the live
page to see how each field lands.

---

## Common mistakes

**Filling a field because it feels obvious.** A landscaping company probably
does mowing. Probably is not sourced. Leave it out.

**Turning review scores into a testimonial.** A 4.8 rating does not license
writing "customers consistently praise their reliability". That is a claim
about what reviews say, made without reading them.

**Resolving a conflict quietly.** Picking the more recent looking source and
moving on loses the single most useful thing you found, which is that the
business's own listings disagree.

**Writing copy before finding the angle.** Produces pages that are technically
accurate and completely interchangeable.

**Editing the generated files.** If the page needs a wording change, change
`prospect.json` and rebuild. Editing `demos/src/data/<slug>/site.js` breaks the
chain between the page and its sources, and the next build overwrites it
anyway.
