# The inbox pipeline

`htpfinder inbox <vertical>` ranks businesses for the one inbox offer: a hosted
Chatwoot that puts web chat, WhatsApp, Instagram, Facebook, email and SMS on one
screen, at $1000 setup plus $200 a month.

It is a separate pipeline from `collect`, and the two look for opposite
businesses. `collect` wants a business with no website, so it can be shown a
demo. `inbox` wants a business with a website, several channels and more
messages than it can answer from one place.

```bash
htpfinder inbox dental --near "Cape Coral, FL" --limit 30 --csv leads.csv
htpfinder inbox med-spa --limit 12 --estimate     # projected cost, no calls
```

## What it costs

Searches are billed to the treg team balance. `openmart.businesses.search` bills
3 credits per 10 rows at about $0.0298 a credit, **rounded up per call**. The
rounding is the part that surprises people: a four row call reserves two whole
credits, so three keywords asking for four rows each costs $0.179 while one
keyword asking for twelve costs $0.119.

Because of that, `--limit` is the price dial and more keywords means more
rounding. `--estimate` prints the projection and exits. A run above
`--max-spend` (default $0.35) refuses to start, and a balance below the
projection refuses too.

Check the balance with `treg balance`, top it up with `treg topup`.

## Stages

1. **source.** One paid search per keyword in the vertical. Returns the website,
   phone, email, Google rating and review count, the social profiles, and a
   `staffs` list. Location is filtered locally, see below.
2. **inspect.** One free homepage fetch per business, reading the HTML for the
   signature of a messaging vendor.
3. **score.** Free and local. Every point is recorded with the reason, so the
   person making the call can see why a lead is near the top.

Enrichment is deliberately not a fourth stage. `treg.companies.enrich` is worth
running on a shortlist a human has already read, not on a sweep, so the command
prints the call rather than making it.

## Why a widget makes a lead better, not worse

The obvious rule, "no chat widget means a lead", is backwards in these verticals.
Dental and med spa are saturated with Podium, Weave and Birdeye. A clinic paying
one of those $300 to $600 a month has proven the budget and already been through
procurement, which makes it a switching conversation. A clinic with nothing may
have no budget and nobody to staff an inbox at all.

So detection sorts into tiers, and the tier sets the pitch:

| Tier | Meaning | Pitch | Points |
| --- | --- | --- | --- |
| `inbox_platform` | Podium, Weave, Birdeye, Intercom, Gubagoo and similar | `switch` | +35 |
| `social_click` | a `wa.me` or Messenger link out to a personal phone | `consolidate` | +28 |
| `chat_widget` | Tawk, Crisp, Tidio and similar single channel widgets | `upgrade` | +20 |
| `none` | nothing in the homepage HTML | `cold` | +8 |
| blocked | the homepage refused the check | `unknown` | +0 |
| `chatwoot` | already runs our product | excluded | n/a |

The rest of the score is channel spread (up to +25, seven points per channel
past the second), review volume as proof of inbound (up to +20), a staff list
inside the band (+15), and being reachable without more research (+5).

## What the data does not tell you

Three limits are real, and the command says so at runtime rather than hiding
them:

**Location is not filtered by the provider.** A query of "dental clinics in
Phoenix, AZ" comes back with practices in Redwood City, Cape Coral and Sioux
Falls. `--near` is applied locally afterwards against the returned city and
state, and the run reports how many rows it dropped. On a tight metro, expect to
ask for several times the rows you want.

**`staffs` is a floor, not a headcount.** It is a list of named people scraped
off the business's own website. A practice that names four dentists and no
hygienists reads as four while employing thirty. The score treats a list inside
the band as evidence and says "unconfirmed" when it is short. Confirm a
shortlist with `treg call treg.companies.enrich --method POST --data
'{"domain":"example.com"}'`.

**A missing widget is not proof.** Detection reads the homepage HTML only, so a
widget injected later by a tag manager is invisible to it. Those results are
marked `uncertain` and the run warns about the count.

## Adding a vertical

Edit `cli/src/lib/verticals.js`. A vertical is a keyword list, the staff band the
offer is priced for, and the note explaining why that trade drowns in messages.
It is deliberately not an `industries/*.js` profile: those carry a service
taxonomy, a directory list and a design motif that exist to render a demo site,
none of which apply here, and filling them with empty values would make the
profile validator report research that nobody did.

## Credentials

Nothing in this repo holds a treg token. `src/lib/treg.js` shells out to the
`treg` CLI, which keeps its own signed in session, and treg injects the provider
key server side. Install and sign in once:

```bash
curl -fsSL https://treg.to/install.sh | sh -s -- --token <token>
treg whoami
```
