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

## Why it needs no login

The server binds to the loopback address and refuses anything that did not come
from it. Three checks do the work, and `cli/test/server.test.js` pins all three:

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

## Working on it

```bash
htpfinder ui --no-open     # the API, on 4317
npm run dev                # this app with hot reload, on 4318
```

The dev server proxies `/api` to 4317, so you are developing against the real
backend rather than a mock.

## Design

htpfinder is an `HTP<product>` sub brand, so the background, the teal pair and
the type roles come from the master `> HTP_` system and are not this tool's to
reinvent. Its own accent is `signal`, an amber used for exactly one thing: the
prospect score, the number this tool exists to produce.

The signature is the command echo. Every action shows the `htpfinder` command it
is about to run, in mono, before it runs. A UI that wraps a CLI can either hide
the machinery or explain it, and explaining it means someone who has never
opened a terminal can see what the button does, and eventually run it themselves.

Layout is checked at 320, 375, 425, 768, 1024 and 1440, per the repository's
responsive requirement. Wide tables scroll inside their own container so the
page never scrolls sideways.
