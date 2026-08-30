# Adding an industry

Everything trade specific lives in one file at `cli/industries/<id>.js`. The
collector, the enrichment brief, the validator and the renderer all read from
it, so a new trade never means editing a component or a script.

Two profiles ship. Read both before writing a third, and notice how little they
share: different Places categories, a completely different directory list, a
review bar of 3 versus 15, and unrelated proof points. That divergence is the
point.

---

## Start with the brief

```bash
cd apps/htpfinder/cli
node bin/htpfinder.js profile "roofing"            # the brief
node bin/htpfinder.js profile "roofing" --scaffold # and a file to fill in
```

This is the industry level twin of `packet`. It prints what the profile has to
answer, what the shipped trades chose so you can see how little they share, and
the icon, motif, mark and palette vocabularies read live out of the renderer, so
the list can never drift from what the renderer actually implements.

Hand it to whoever, or whatever, is doing the research. The rest of this page is
the long form of the same thing.

---

## Do the research first

The strong temptation is to copy `lawn-care.js`, change the words, and move on.
That produces a profile that looks right and quietly performs badly.

**Research three businesses in the trade by hand before writing anything.**
Find them on Google, then go looking for years in business, owner name and
service list. Notice which sites actually had the answer. That is your
`directories` list, and there is no way to derive it from a desk.

Real example of why: for lawn care the useful facts lived on HomeGuide, Angi,
HomeAdvisor, BBB and Networx. For auto repair almost none of those help, and
the answers are on RepairPal, NAPA AutoCare and CARFAX. A lawn care directory
list pointed at auto shops returns nothing useful, and the enrichment step
silently produces thin pages.

While researching, also notice **how many reviews a normal business in this
trade has**. That number sets your thresholds and it varies enormously.

Record what you found in the `research` block, which is what makes the two
fields above checkable by something other than trust:

```js
research: {
  date: '2026-08-28',
  businesses: [
    { name: 'Real Business', url: 'https://...', reviews: 42, foundOn: ['angi.com'] },
  ],
},
```

`htpfinder industries` then reports a directory that no researched business was
actually found on, which is the signature of a list somebody guessed, and a
`minReviews` set above the smallest business you looked at, which is a profile
that would have filtered out its own evidence.

---

## Write the profile

```bash
cd apps/htpfinder/cli
cp industries/_template.js industries/roofing.js
```

Files starting with an underscore are ignored by the loader, so the template
never shows up as a real trade.

### id and label

`id` must match the filename. The validator checks this.

### places

```js
places: {
  includedTypes: ['roofing_contractor'],
  keywords: ['roofing', 'roof repair', 'roof replacement', 'gutter installation'],
}
```

Places categories are coarse, so the keyword sweep is what actually finds small
operators. Each keyword becomes its own search. Include the phrasings a
customer would use, not just the industry term.

### qualify

```js
qualify: {
  minRating: 3.5,
  minReviews: 15,
  idealReviews: 100,
}
```

`minReviews` is the bar for "this business demonstrably has customers".
`idealReviews` is where review volume stops adding to the score. Both come from
the research pass, not from another profile.

Getting these wrong is subtle. Too low and agent time goes to businesses with
no public signal to write a page from. Too high and you filter out exactly the
under the radar operators worth pitching.

### directories

Ordered by how often each paid off in your research. The enrichment brief
prints them in this order, and whoever does the research works down the list.

### serviceTaxonomy

```js
serviceTaxonomy: [
  { key: 'roof-repair', label: 'Roof repair', icon: 'Hammer' },
]
```

Normalizes wording so two prospects do not describe the same job differently.
Prospect files reference services by `key` only, so this file controls both the
displayed label and the icon.

`icon` must exist in `demos/src/lib/icon-names.js`. A test enforces this, so a
typo fails `npm test` rather than silently rendering a fallback leaf on
somebody's demo. Add new icons to both `icon-names.js` and `icons.js`.

Aim for coverage of what the trade actually sells. Twenty entries for lawn
care, fourteen for auto repair.

### design

```js
design: {
  motif: 'diagonal-rule',
  mark: 'roof',
  paletteFamilies: ['icy-blue', 'summer'],
}
```

`motif` is the hero texture. Implemented options live in
`demos/src/styles/index.css` as `.motif-*`: `mow-stripes`, `diagonal-rule`,
`grid`, `plain`. Add one there if the trade needs it.

`mark` is the header icon, from `demos/src/components/BrandMark.jsx`. Currently
`leaf`, `wrench`, `roof`, `spark`.

`paletteFamilies` constrains which of the four seasonal families this trade
draws from. Narrowing it is usually right: an auto shop in blossom pink is a
worse demo than one in slate. Twelve palettes exist across four families, and
the picker spreads across families before repeating one.

### guidance

Handed to whoever does the enrichment. This is the difference between a page
about a category and a page about a business.

```js
guidance: {
  audience: 'Who reads this page and what they are worried about.',
  proofPoints: ['What actually reassures a customer in this trade'],
  anglesToAvoid: ['Claims that are tempting to make and unsafe to make'],
  seasonalNote: 'When demand spikes, which shapes outreach timing.',
}
```

`anglesToAvoid` deserves real thought. Every trade has claims that are tempting
and legally or reputationally risky: certifications in auto repair, licensing
and insurance in the trades, outcome claims in anything medical. Naming them
here stops them reaching a page.

---

## Check it

```bash
node bin/htpfinder.js industries      # confirms it loads and summarizes it
npm test                              # icon cross check and profile validation
```

A half finished profile is a normal state and will not break anything. It shows
up under `industries` as "started, not usable yet" with a list of what is still
missing, while every other trade keeps working. Trying to actually run
`collect` against an incomplete profile fails with the same list.

Then a real run:

```bash
export GOOGLE_PLACES_API_KEY=...
node bin/htpfinder.js collect roofing --near "Portland, OR" --limit 25 --dry-run
```

`--dry-run` prints what would be written without writing anything, which is the
right way to sanity check keyword coverage and the qualifier before committing
prospects to the repo.

Read the output critically. Are these actually roofers? Is the score ordering
sensible? Are businesses being skipped that should not be? Tune the keywords
and thresholds and run again.

---

## Consider a fixture

Once a live run looks right, saving one as a fixture lets anyone develop
against that trade offline and without spending quota.

Save the raw response bodies as `{ "places": [ ... ] }` in
`cli/fixtures/<trade>-<place>.places.json`. Note in the file what is real and
what is not; prospects collected from a fixture are marked and cannot be built.
