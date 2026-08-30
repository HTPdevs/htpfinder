# Troubleshooting

Real failure modes, most of them hit while building this.

---

## Collect

### GOOGLE_PLACES_API_KEY is not set

Either export a key, or run offline:

```bash
node bin/htpfinder.js collect lawn-care --fixture portland-lawn-care.places.json
```

### Businesses I know have websites are showing up as prospects

Check the WHY column. If it says "listed site is up but blocked our check", the
qualifier already handled it and those were skipped.

If a business with a real site is being kept for another reason, the likely
cause is that its listed URL points at a directory or social page rather than
its own site. That is usually correct behavior: a Facebook page is a presence,
not a website, and it is exactly the gap worth pitching against. Use
`htpfinder show <slug>` to see the reason recorded.

### Businesses with no website are being skipped

Almost always the reverse of the above. A site that returns 401, 403 or 429 is
treated as **live**, because small business sites frequently sit behind a
filter that rejects an unfamiliar user agent, and counting those as "no
website" fills the list with businesses that already have one.

If you believe a specific skip is wrong, check the URL by hand. To see every
result including skips:

```bash
node bin/htpfinder.js collect <industry> --near "..." --keep-live --dry-run
```

### Too few results

The keyword sweep drives coverage more than the category filter. Add the
phrasings customers actually use to `places.keywords` in the industry profile.
Also confirm `qualify.minReviews` is not set too high for the trade.

### The site check is slow

Each candidate with a listed URL gets a fetch with a six second timeout. Use
`--no-check` to skip it, but understand what you lose: parked domains, dead
domains and redirects to aggregators all go undetected, and those were a
meaningful share of real prospects in the Portland pass.

---

## Validate

### "present but has no valid source URL"

A fact was filled in without a source, or with something that is not an
`http` URL. Either add the real listing URL or set the field to `null`. There
is no third option.

### "missing a url, so the quote cannot be verified"

A review quote needs `text`, `source` and a real `url`. If you cannot link the
review, remove it. An empty `reviewQuotes` array renders fine.

### "is not in the <industry> service taxonomy"

The service `key` does not exist in that trade's profile. Either use an
existing key, or add the service to `serviceTaxonomy` in
`cli/industries/<id>.js` if the trade genuinely offers it.

### "contains a dash"

CLAUDE.md forbids dashes in copy. Restructure the sentence rather than
substituting a similar character; the check covers hyphen, en dash, em dash,
figure dash, horizontal bar and minus sign.

Phone numbers are exempt. If a phone number is being flagged, it is in a format
the exemption does not match; check `cli/src/lib/copy-rules.js`.

### "collected from a fixture"

Working as intended. Fixture ratings are placeholders. Re collect against the
live API before building anything that carries a real business name.

### Warnings about copy outrunning the facts

The copy says something like "owner operated" or mentions years in business
while the corresponding fact is `null`. Either source the fact or change the
copy. This warning is the validator catching the exact failure the system
exists to prevent, so treat it as an error in practice.

---

## Build

### "design: missing, run build to assign a palette"

Only appears when validating a prospect that has never been built. `build`
assigns a palette on first run. Validate again afterwards.

### Two demos look too similar

The palette picker spreads across families before repeating one, so this
usually means a trade's `paletteFamilies` is narrow. Override explicitly:

```bash
node bin/htpfinder.js build <slug> --palette icy-slate
```

`htpfinder packet <slug>` lists the ids still free.

### My edits to the demo keep disappearing

You are editing generated files. Everything in `demos/src/data/<slug>/` is
overwritten by `htpfinder build`. Edit `prospect.json` and rebuild.

---

## Renderer

### The page renders blank

Almost certainly opening `dist/<slug>/index.html` directly from the filesystem.
ES modules do not load over `file://`. Serve it:

```bash
cd demos && VITE_DEMO=<slug> npm run dev
```

This one is worth knowing because the responsive checker originally reported
every breakpoint clean while every page was blank. It now asserts the page
actually rendered, so `check-responsive.mjs` catches it.

### A service shows a leaf icon instead of the right one

The icon named in the industry profile is not in the renderer registry. Add it
to both `demos/src/lib/icon-names.js` and `demos/src/lib/icons.js`. `npm test`
in `cli/` cross checks these, so this should fail a test before it reaches a
page.

### A hero texture is missing

Motif classes are deliberately defined outside Tailwind's `@layer components`,
because the class name is assembled at runtime from the industry profile and
Tailwind's scanner cannot see it. Anything in a purgeable layer gets stripped.
Add new motifs to the plain CSS block at the end of `demos/src/styles/index.css`.

### Layout breaks at a narrow width

```bash
cd demos && CHROMIUM_PATH=<path> node scripts/check-responsive.mjs
```

Fails on horizontal overflow, a JavaScript error, or a blank render, and names
the offending elements. Screenshots land in `.screenshots/`.

### Playwright cannot find a browser

The bundled browser build may not match the installed Playwright version. Point
at an existing one:

```bash
CHROMIUM_PATH=/path/to/chrome node scripts/check-responsive.mjs
```

---

## Control panel

### "The UI has not been built yet"

```bash
cd ui && npm install && npm run build
```

The server serves `ui/dist`, which is gitignored because it is generated.

### Port 4317 is already in use

Another copy is running, or something else took the port. `htpfinder ui --port
4318` moves it.

### "Refusing a request for host" or "Refusing a cross origin request"

Working as intended. The server only answers requests that came from the
loopback address, which is what lets it run without a login. Reach it at
`http://localhost:<port>`, not through any other hostname or tunnel.

### My changes to the UI are not showing

The browser is holding the old bundle, or you did not rebuild. Run `npm run
build` in `ui/`, then hard reload. While actually working on it, run `htpfinder
ui --no-open` and `npm run dev` together instead and use port 4318.

---

## Sync

### "Supabase is not configured"

Copy `.env.example` to `.env` and fill in the four `SUPABASE_` values. Real
environment variables override the file, so an exported value wins.

### "Invalid login credentials"

The account named in `.env` does not exist yet, or the password does not match.
Create it once with `htpfinder sync login --signup`.

If the project has email confirmation on, signup creates the user but no
session, and every command keeps failing this way until the address is
confirmed. `sync login --signup` says so when that happens.

### Push says everything is already in sync when it is not

Both sides are compared on content, not timestamps, so this means the stored row
really does match the file. If you expected a difference, check you edited
`prospect.json` and not a generated file under `demos/src/data/<slug>/`.

### Pull refuses to overwrite

The local file and the stored row both changed since they last matched. Nothing
merges them, on purpose: picking a winner silently is how sourced research gets
lost. Read the local copy with `htpfinder show <slug>`, then either push it or
pass `--force` to take the stored version.

### A pushed prospect never appears

Its stored row is soft deleted, so the active view hides it and push skips it
with a warning. Something removed it deliberately, sometimes for a removal
request. `--force` puts it back.

### A pulled prospect has no raw.json

Working as intended. The verbatim Places response is not stored anywhere, since
Google's terms restrict keeping Places content. Only `placeId` travels. Re
collect if you need the raw response again.

---

## General

### Where is the state?

`data/prospects/<slug>/`. Plain files on disk. `raw.json` is the verbatim
Places response and is never edited; `prospect.json` is the working file.

Supabase is the store of record. `htpfinder sync push` sends local prospects up,
`htpfinder sync pull` brings stored ones down, and `htpfinder sync status` says
what differs. See [../supabase/README.md](../supabase/README.md).

`data/` is gitignored, because prospect files carry owner names, direct phones
and addresses that for a sole proprietor are often personal. So there is no
commit history to read a record's past out of, and no `git checkout` to undo a
bad edit with. `htpfinder collect` is what gets you back to a clean starting
point. Copy `prospect.json` aside first if a pass is worth keeping.

### I want to start over on one prospect

Delete its directory and re collect. Or delete just `prospect.json` and keep
`raw.json`, then re collect to rebuild the derived file without another API
call.

### Re collecting overwrote my research

It should not. Collect only overwrites facts Places is authoritative for: name,
phone, address, hours, location, types, and the Google rating and quotes.
Everything added during enrichment survives. If something was lost, check
whether it was one of those fields.
