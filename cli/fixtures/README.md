# Fixtures

Recorded Google Places responses, used by `htpfinder collect --fixture`.

They exist so the pipeline can be developed, tested and demonstrated without a
Places API key and without spending quota. The shape matches what the Places
`searchText` endpoint returns, so anything that works against a fixture works
against the live API.

`portland-lawn-care.places.json` is synthetic. Names, phones and street
addresses are invented, with phones in the 555-01xx range reserved for fiction.
Cities and coordinates are real at neighborhood precision, because the collector
filters on locality.

It started as a transcript of a real Portland pass and was anonymized, because a
fixture is the one part of this pipeline that is meant to be committed, and real
operators' names and direct phone numbers are not something to make permanent in
a git history. Nothing was lost: the qualifier and the scorer care about the
shape of a response and the distribution within it, never about whether a phone
number dials.

What is deliberate and worth preserving if you edit it:

- three website tiers, so `qualify.js` gets exercised end to end: businesses with
  no URL, one pointing at an aggregator (`yelp.com`), and two pointing at live
  domains (`example.com`, `example.org`, which resolve, so the fetch check
  behaves as it would against a real site)
- review counts from none to 49, spanning the scoring range
- businesses missing a phone, an address, hours or a rating, since real Places
  responses are ragged and the collector has to tolerate that
- `Meadowline Yard Inc` and `Marco's Landscaping`, which exercise the suffix and
  apostrophe rules in `slugify`

`reviews` arrays stay empty. Places review text is not captured by this stage,
and inventing quotes would defeat the provenance rules the tool enforces.

To record a fresh fixture from a live run, save the raw response bodies from
`collectPlaces` into a file shaped as `{ "places": [ ... ] }`, then anonymize it
before committing.
