# Control panel

Everything the CLI does, in a browser, for people who do not use a terminal.

```bash
cd ui && npm install && npm run build
htpfinder ui
```

That opens `http://localhost:4317`. The build only needs redoing when this
directory changes.

## How it fits together

`htpfinder ui` starts a small server from `cli/src/server/`, which serves the
built files here and exposes the pipeline as JSON. Every handler calls the same
libs the commands call, so the validator, the scorer, the qualifier and the
store are shared. The UI and the CLI cannot disagree about whether a prospect is
ready, because there is only one implementation of the question.

The same server also serves finished demo sites at `/demo/<slug>/`, straight out
of `demos/dist/`. Build the demo site renders the page and then offers to open
it, so what a prospect would get is one click away with no second dev server
involved. Writing the two source files without rendering a page is the option
rather than the default, because from the outside a button that writes files
you cannot open looks like a button that does nothing.

## Signing in

The panel asks who is using it before showing anything. `#/` renders
[Login.jsx](src/screens/Login.jsx), which offers "Continue with GitHub" and
"Continue with Google": both call `supabase.auth.signInWithOAuth` and both
redirect back here once the provider confirms who you are.

The panel builds this client itself, in the browser, from the project URL and
publishable key `/api/state` already returns. Neither is a secret: the
publishable key ships in client bundles by design, and it is the same one the
CLI signs in with for `htpfinder sync`. Sign out clears that session and
drops you back at the login screen.

This needs a GitHub OAuth App and a Google OAuth client registered as
**providers in the Supabase Dashboard** (Authentication > Providers), using
the `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` and `OAUTH_CLIENT_ID`/
`OAUTH_CLIENT_SECRET` pairs already in `.env`. Both OAuth apps also need this
panel's origin (`http://localhost:4317` in production, `http://localhost:4318`
while running `npm run dev`) listed as an authorized redirect. None of those
four values are read by this repo's code; they only ever go into the
Dashboard, since GoTrue is what actually talks to GitHub and Google.

## Why the server itself needs no login

Signing in gates what the panel shows you, but the local server behind it
never checked a password to begin with. It binds to the loopback address and
refuses anything that did not come from it. Three checks do the work, and
`cli/test/server.test.js` pins all three:

- **Host must be a loopback name.** A page on the internet can point a hostname
  it controls at 127.0.0.1 and have your browser send requests here. The rebound
  name will not match, so it is refused.
- **Origin, when present, must be this server.** Browsers attach it to cross
  site requests.
- **Writes must be `application/json`.** A cross origin form or image tag can
  fire a request without a preflight, but it cannot set that content type. No
  CORS headers are ever sent, so even a permitted read cannot be read back by
  another origin.

This matters more than it looks: the server writes files, spends Google Places
quota and holds a signed in Supabase session.

## Screens

`#/` is a hero and a two field form: trade and place. Submitting it hands those
to `#/collect` through the hash query rather than starting a sweep, so a live
search still takes a deliberate click on a screen that shows the whole command
first. The other tabs are the prospect list, the full Find options, the trade
profiles and the Supabase status.

A sweep reports as it runs. `/api/collect` streams one JSON object per line and
the Find screen shows each business as its site is checked, because sixty
website fetches behind a spinner is indistinguishable from a hang.

## Words this tool uses

Prospect, sweep, provenance, palette, copy. The vocabulary stays, because it is
what the CLI, the docs and the schema call these things, and a UI that renames
everything teaches names that then match nothing. The explanation comes to you
instead: the `Hint` primitive puts a question mark beside a term and a plain
sentence behind it, on hover or on focus, so it reaches a keyboard and a phone
as well as a mouse.

## Working on it

```bash
htpfinder ui --no-open     # the API, on 4317
npm run dev                # this app with hot reload, on 4318
```

The dev server proxies `/api` to 4317, so you are developing against the real
backend rather than a mock.

## Design

htpfinder is an `HTP<product>` sub brand, so the background, the type roles and
the layout language come from the master `> HTP_` system and are not this tool's
to reinvent. What differs is the accent: `signal`, an amber dark and bright pair
standing in for the master teal, on this tool's own surfaces only.

`ok`, a green, is not a second accent. It is a functional status colour, and it
exists because three places had teal meaning "this is fine" sitting next to
amber meaning something else: a note that succeeded beside one that warns, a
prospect that is stored beside one that is not, a status further along beside
one earlier. Making both amber would have made those pairs unreadable.

The signature is the command echo. Every action shows the `htpfinder` command it
is about to run, in mono, before it runs. A UI that wraps a CLI can either hide
the machinery or explain it, and explaining it means someone who has never
opened a terminal can see what the button does, and eventually run it themselves.

Layout is checked at 320, 375, 425, 768, 1024 and 1440, per the repository's
responsive requirement. Wide tables scroll inside their own container so the
page never scrolls sideways.
