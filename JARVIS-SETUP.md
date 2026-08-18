# JARVIS in Trackr

A JARVIS view sits at the top of the sidebar, above Overview. Orb centred, text
bar pinned to the bottom, conversation in between. Your existing Overview is
untouched.

Every question is sent with a plain-text snapshot of what the dashboard knows:
today's date and rotation, the day's periods with times and rooms, overdue work,
what's due today, the next 20 upcoming items, every class with its teacher,
room and grade — plus a MEMORY block of facts you've asked JARVIS to remember.

## Fully online — one backend

Everything goes through **`/api/jarvis`**, the serverless proxy deployed beside
the page. Nothing needs to run on your PC. If the proxy is unreachable the page
still answers the common questions (schedule, due, overdue, grades) from its own
data and labels itself `offline - dashboard only`, so it never just fails.

### Hosted setup (Vercel)

`api/jarvis.js` is a Vercel-style serverless function. Deploy it beside the HTML:

```
your-project/
  index.html
  api/jarvis.js
```

Then set **`OLLAMA_API_KEY`** in your host's environment variables and redeploy.

> **Never put the key in the HTML.** That file is public — anyone who opens
> view-source can read it and spend against your account. Keeping it in an
> environment variable, where only the server sees it, is the entire reason this
> proxy exists rather than the page calling Ollama directly.

Netlify and Cloudflare want a slightly different handler signature but the same
shape: read body, add key server-side, forward, return `{ reply }`.

## Memory

The proxy is stateless; memory lives in the page.

- Tell JARVIS "remember that ..." and it saves the fact (via a `remember`
  action) into localStorage alongside your assignments and grades.
- Every saved fact is sent back with every question, so the online JARVIS
  genuinely remembers across sessions on that browser.
- "Forget ..." removes a saved fact.

### Exporting a memory file for the PC AI

The **MEMORY FILE** button in the JARVIS header downloads
`jarvis-memory-YYYY-MM-DD.json` containing:

- `memory` — every saved fact, with the date it was learned
- `conversation` — the current chat transcript
- `dashboard` — the full plain-text snapshot (schedule, work, grades)

It's plain JSON, so you can upload or import it into the assistant on your PC
(or any other tool) whenever you want to sync what the online JARVIS knows.

Note: localStorage is per-browser — memory saved on your phone stays on your
phone. Export a memory file from each device you want to sync.

## Editing the page later

`index.html` is a bundled artifact, not editable source. Extract the
`__bundler/template` JSON to a file, edit that, re-encode, splice it back — see
the project memory note. The escape that matters is `</` → `<\u002F`; build that
replacement with `chr(92)` rather than a `"\\u002F"` literal, because the latter
collapses to `/` and turns the whole thing into a silent no-op that closes the
host `<script>` early.
