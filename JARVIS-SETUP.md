# JARVIS in Trackr

A JARVIS view sits at the top of the sidebar, above Overview. Orb centred, text
bar pinned to the bottom, conversation in between. Your existing Overview is
untouched.

Every question is sent with a plain-text snapshot of what the dashboard knows:
today's date and rotation, the day's periods with times and rooms, overdue work,
what's due today, the next 20 upcoming items, and every class with its teacher,
room and grade.

## Two backends, tried in order

The page tries each and uses the first that answers. You don't configure
anything at the page level — it just falls through.

| Order | Endpoint | What answers | Has |
|---|---|---|---|
| 1 | `/api/jarvis` | Ollama Cloud via your host | dashboard snapshot only |
| 2 | `http://127.0.0.1:8765/chat` | the Python JARVIS on your machine | memory, MCP tools, specialists |
| 3 | — | the page itself | schedule, due, overdue, grades |

Order matters: same-origin first because it works everywhere, local second
because it's more capable but only reachable when you're at your desk. If both
are down the panel still answers the common questions and labels itself
`offline - dashboard only`, so it never just fails.

### 1. Hosted (works anywhere)

`api/jarvis.js` is a Vercel-style serverless function. Deploy it beside the HTML:

```
your-project/
  Trackr-standalone.html
  api/jarvis.js
```

Then set **`OLLAMA_API_KEY`** in your host's environment variables and redeploy.

> **Never put the key in the HTML.** That file is public — anyone who opens
> view-source can read it and spend against your account. Keeping it in an
> environment variable, where only the server sees it, is the entire reason this
> proxy exists rather than the page calling Ollama directly.

Netlify and Cloudflare want a slightly different handler signature but the same
shape: read body, add key server-side, forward, return `{ reply }`.

### 2. Local (full assistant)

```powershell
cd "C:\Users\patel\Iron man"
.\.venv\Scripts\python.exe -m jarvis.main serve
```

Serves on `127.0.0.1:8765`. This is the only path with his long-term memory, the
20 MCP tools and the specialist agents behind it — so it can answer things the
dashboard doesn't contain, and remember what you tell it.

An `https://` page reaching `http://127.0.0.1` works because loopback counts as a
trustworthy origin, so mixed-content blocking doesn't apply. Chrome additionally
runs a Private Network Access preflight for public→loopback requests; the bridge
answers it with `Access-Control-Allow-Private-Network: true`. If a policy on the
machine disables PNA outright, the page simply falls through to the hosted path.

Once your domain is live, lock the bridge down in `Iron man/config.yaml`:

```yaml
server:
  allow_origins: ["https://yourdomain.com"]
```

While it's `["*"]`, any site you visit could ask your assistant questions.

## Editing the page later

`Trackr-standalone.html` is a bundled artifact, not editable source. Extract the
`__bundler/template` JSON to a file, edit that, re-encode, splice it back — see
the project memory note. The escape that matters is `</` → `<\u002F`; build that
replacement with `chr(92)` rather than a `"\\u002F"` literal, because the latter
collapses to `/` and turns the whole thing into a silent no-op that closes the
host `<script>` early.

`Trackr-standalone.html.bak` is the pre-JARVIS version if you want to roll back.
