/**
 * Serverless proxy for the Trackr JARVIS panel.
 *
 * Deploy this alongside Trackr-standalone.html and the page reaches it at
 * /api/jarvis - same origin, so there is no CORS and no mixed-content problem.
 *
 * WHY THIS EXISTS AT ALL
 * The obvious shortcut is to call Ollama straight from the browser with the key
 * in the HTML. Do not. That page is public: anyone who opens view-source has
 * your key and can spend against it. The key belongs in an environment variable
 * on the server, which is the whole job of this file.
 *
 * SETUP (Vercel)
 *   1. put this at  api/jarvis.js  in the deployed project
 *   2. Project Settings -> Environment Variables -> OLLAMA_API_KEY = <your key>
 *   3. redeploy
 *
 * Netlify/Cloudflare want a slightly different signature but the same shape:
 * read the body, add the key server-side, forward, return the reply.
 *
 * WHAT THIS DOES NOT DO
 * This talks to Ollama Cloud directly, so it has the dashboard snapshot the page
 * sends and nothing else - no long-term memory, no MCP tools, no specialists.
 * Those live in the Python process on your machine, which the page tries first
 * at 127.0.0.1:8765 whenever you are sitting at it. This is the away-from-home
 * path: still useful, deliberately less capable.
 */

const MODEL = process.env.JARVIS_MODEL || "gpt-oss:120b";

const PERSONA = `You are JARVIS, Savan's assistant, answering from inside his school
dashboard. Dry, understated, competent. Address him as "sir".

The DASHBOARD block below is what he is looking at right now. It is current and
authoritative - prefer it over anything you might assume about his schedule.

Answer in one to three sentences unless he asks for more. A short list is fine when
it genuinely helps. Never invent a class, teacher, room, date or grade: if the
dashboard does not say, tell him it does not say.`;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.OLLAMA_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: "OLLAMA_API_KEY is not set on the server. Add it in your host's " +
             "environment variables and redeploy."
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const message = String(body?.message || "").trim();
  if (!message) return res.status(400).json({ error: "empty message" });

  const context = String(body?.context || "").trim();
  const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];

  const messages = [
    { role: "system", content: PERSONA + (context ? "\n\nDASHBOARD\n" + context : "") },
    // Drop the final history entry: it is this same message, already echoed into
    // the transcript by the page before the request went out.
    ...history.slice(0, -1).filter(m => m && m.role && m.content),
    { role: "user", content: message }
  ];

  try {
    const upstream = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        options: { temperature: 0.6, num_predict: 1024 }
      })
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(502).json({ error: `upstream ${upstream.status}`,
                                    detail: detail.slice(0, 300) });
    }

    const data = await upstream.json();
    const reply = String(data?.message?.content || "").trim();
    if (!reply) {
      // Reasoning models spend their budget in a separate `thinking` field and
      // can return empty content. Say so rather than returning a blank bubble.
      return res.status(200).json({
        reply: "I couldn't put an answer together that time, sir. Try again?"
      });
    }
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: String(err).slice(0, 300) });
  }
}
