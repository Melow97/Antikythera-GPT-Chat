# Antikythera GPT Chat

[![Follow on X](https://img.shields.io/badge/Follow-@Antikythera67-000000?logo=x)](https://x.com/Antikythera67)

## ✨ Key Features

* 🚀 **Effortless local setup** — `npm install`, copy `.env.example` to `.env`, `npm start`.
  No Docker or Kubernetes needed to run your own instance.
* 🤖 **Ollama-only chat** — free, no chat API key required. Run fully local, or point at
  Ollama Cloud ("Turbo") with your own key.
* 🔌 **Real OAuth connections** — Google, Microsoft, GitHub, Slack, Zoom, Dropbox, and
  Canvas, using genuine OAuth 2.0 flows against each provider, not mocked integrations.
* 🔎 **Deep web search with citations** — toggle it on before a message sends to ground
  answers in current sources via Ollama's own web search API.
* ✈️🏨 **Flights & hotels lookup** — auto-detected straight from your message (no manual
  toggle), via Kiwi.com and Amadeus' developer APIs.
* 🎓 **Built to flex to how you work** — studying for exams, writing essays, working
  through assessments and homework, debugging code, IT/ops triage, security research, or
  content-moderation support.
* 🔐 **Security by default** — AES-256-GCM-encrypted OAuth token storage, bcrypt-hashed
  passwords, rate-limited auth routes, session rotation on login, and Helmet security
  headers.
* ✉️ **Email verification & password reset** — 6-digit code sign-up verification and a
  reset-link flow, both sent via Resend.
* 🪪 **Sign in your way** — email/password or "Continue with Google," your choice.
* 🛠️ **Admin panel** — pick the default Ollama model, view basic usage stats, and post a
  site-wide announcement banner.
* 📖 **Open source & self-hosted** — inspect it, fork it, or run your own instance. Free
  while it's early-stage.

## The app (server.js)

A ChatGPT-style chat page with a sidebar (conversation list, Settings, Connections), a
settings panel (theme, persona/system prompt — saved to `localStorage`), and a Connections
page that does **real OAuth 2.0** against Google, Microsoft, GitHub, Slack, and Zoom.

### Setup

1. `npm install` (also used by clone-site.js — installs Express, dotenv, Playwright).
2. `cp .env.example .env` and fill in the values you need (see below). Never commit `.env`
   or paste its contents into chat.
3. `npm start` → open `http://localhost:3000`.

### Sign-in (gated access)

`http://localhost:3000/` is now a public landing page; the chat app itself lives at `/app`
and requires a signed-in session to reach — unauthenticated requests to `/app` or any
`/api/*` route redirect back to the landing page.

Sign-in is "Continue with Google," using the **same** `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
as the Connections feature below, but it's a separate OAuth purpose (identity only — scope
is just `openid email profile`, no Gmail/Calendar/Drive access) and needs its **own** redirect
URI registered in Google Cloud Console, in addition to the Connections one:

```
{BASE_URL}/login/google/callback     ← sign-in (new)
{BASE_URL}/auth/google/callback      ← Connections (existing)
```

Also set `SESSION_SECRET` in `.env` to anything long and random — the app runs with an
insecure default (and logs a warning) if it's left blank, which is fine for a quick local
test but not for anything else. Log out via the link in the sidebar (`/login/logout`).

### Chat

Runs on **Ollama only** — free, no chat API key required. Two modes, picked automatically
based on what's in `.env`:
- *Local* (default) — install [Ollama](https://ollama.com), make sure it's running
  (`ollama serve`, or it's already running as a background app on Windows/Mac), then pull a
  model once: `ollama pull llama3.2`. Talks to `http://localhost:11434` by default.
- *Cloud/"Turbo"* — set `OLLAMA_API_KEY` in `.env` (from your ollama.com account) and
  Antikythera GPT Chat automatically points at `https://ollama.com` instead of localhost. Override with
  `OLLAMA_BASE_URL` if your cloud endpoint differs.

The model itself (which one Ollama uses) defaults to `llama3.2` and is picked server-side —
it's not a per-user setting, but the admin account (`ADMIN_EMAIL` in `.env`) can change the
default for everyone from the in-app Admin panel, stored in `data/admin-settings.json`.
Persona/system prompt is visible to everyone and saved in the browser's `localStorage`,
along with conversation history — there's no server-side chat history yet.

### Composer bar extras

- **+ (attach)** — attaches a text-based file (`.txt`, `.md`, `.csv`, `.json`, code files).
  Its content is appended as context for that message only; the file itself isn't stored.
- **🔌 (connect)** — shortcut to the Connections page.
- **🎤 (voice)** — dictates into the composer using the browser's built-in speech recognition
  (Web Speech API). Chrome/Edge only; audio is sent to the browser vendor's recognition
  service, not to this app's server.
- **🔎 Deep search** — toggle on before sending a message to run a real web search via
  [Ollama's own web search API](https://ollama.com/api/web_search) and feed the results to
  the model as context, with a citation instruction. Needs `OLLAMA_API_KEY` in `.env` (a free
  Ollama account — get a key at https://ollama.com/settings/keys) — this is required for
  search even if your chat model runs fully locally; see the note on `OLLAMA_API_KEY` in
  `.env.example` if you want chat to stay local while search still works. Off by default;
  without a key set, toggling it on just fails silently and the message sends without search
  context.
- **Flights** — no toggle needed; automatically detected whenever your message contains
  3-letter IATA airport/city codes and a date, e.g. *"flights from LON to NYC on
  2026-08-01"*. Runs a real search via
  [Kiwi.com's Tequila API](https://tequila.kiwi.com/portal/login) (free self-serve signup,
  no partner approval needed — needs `KIWI_API_KEY` in `.env`), and results show up as a
  card directly in the chat (airline, times, stops, price, a "Book ↗" link) immediately,
  independent of the model's reply. If your message doesn't contain a detectable
  origin/destination/date, the lookup is simply skipped — nothing shows up and the message
  sends as normal.
- **Hotels** — no toggle needed; automatically detected whenever your message contains a
  3-letter city code and two dates, e.g. *"hotels in PAR from 2026-08-01 to 2026-08-03"*.
  Runs a real search via
  [Amadeus for Developers' self-service Hotel API](https://developers.amadeus.com/register)
  (free signup, no partner approval needed — needs `AMADEUS_CLIENT_ID` and
  `AMADEUS_CLIENT_SECRET` in `.env`). Results show up as a card (hotel name, rating, room
  type, price) plus a "Compare & book on Booking.com ↗" link, since this tier is a sample
  test dataset rather than full live inventory — worth double-checking prices before
  booking. If your message doesn't contain a detectable city/check-in/check-out, the lookup
  is simply skipped.

### Connections (real OAuth)

Each provider needs its own OAuth app registered on that provider's developer console,
with the redirect URI set to `{BASE_URL}/auth/<provider>/callback` (e.g.
`http://localhost:3000/auth/google/callback`). Put the resulting client ID/secret into
`.env` — a provider with no credentials set shows "Not configured" in the UI instead of a
broken Connect button. Where to register each one:

| Provider | Register at | Covers |
|---|---|---|
| `google` | console.cloud.google.com → APIs & Services → Credentials | Gmail, Calendar, Drive (read-only scopes) |
| `microsoft` | portal.azure.com → App registrations | Excel/OneDrive/Outlook via Microsoft Graph |
| `github` | github.com/settings/developers → OAuth Apps | Repos, user profile |
| `slack` | api.slack.com/apps | Channels, messages |
| `zoom` | marketplace.zoom.us → Develop → Build App (OAuth type) | Zoom account access |
| `dropbox` | dropbox.com/developers/apps | Files, account info (read-only scopes) |
| `canvas` | Your institution's Canvas admin → Developer Keys (self-hosted, so also set `CANVAS_BASE_URL` to your institution's Canvas URL) | Courses, assignments, files |

Tokens are stored locally in `data/connections.json` (gitignored) — fine for single-user
local dev, not a production-ready credential store. Clicking "Disconnect" deletes the
stored token; it does not revoke it on the provider's side.

## clone-site.ps1 / clone-site.js

A separate, standalone tool (unrelated to the app above) — clones the *visual design* of a
webpage into a self-contained `index.html` + `style.css`. `clone-site.ps1` is a thin
PowerShell entry point; the actual work (headless screenshot + DOM capture via Playwright,
then calling an AI provider to rebuild the layout) lives in `clone-site.js`. This one still
uses OpenAI/DeepSeek, since it needs a vision-capable model to read the screenshot — the
Ollama-only change above only applies to the chat app.

Two providers are supported:
- **openai** (default) — vision-capable (`gpt-4o`). The screenshot is sent to the model, so
  colors, spacing, and imagery placement are reconstructed accurately.
- **deepseek** — text-only. DeepSeek's chat API does not accept images, so the clone is
  reconstructed from the DOM alone; expect rougher visual fidelity.

## Requirements

- Node.js (Playwright manages its own bundled Chromium — no system browser needed).
- Run `npm install` once to pull in Playwright and its browser binary.
- An API key for whichever provider you use: `$env:OPENAI_API_KEY = "sk-..."` or
  `$env:DEEPSEEK_API_KEY = "sk-..."`
- Never commit your API key or paste it into a shared/logged chat — treat it like a password.

## Usage

```powershell
.\clone-site.ps1 -Url "https://example.com" -Open
```

Use DeepSeek instead (text-only, lower visual fidelity):

```powershell
.\clone-site.ps1 -Url "https://example.com" -Provider deepseek -Open
```

Swap in custom hero copy instead of the original site's wording:

```powershell
.\clone-site.ps1 -Url "https://example.com" -Tagline "Make AI work for you" -Open
```

Output is written to `.\clones\<host>-<timestamp>\`:
- `index.html`, `style.css` — the rebuilt clone
- `reference.png` — the screenshot used as the visual reference (captured regardless of provider)
- `reference.dom.html` — the rendered DOM used for text/content context

Optional params: `-OutDir`, `-Provider`, `-ApiKey`, `-Model`, `-WindowWidth`, `-WindowHeight`, `-Tagline`.

## Scope and limits

This rebuilds layout, typography, color, and spacing from a screenshot — it does not
copy the original site's JS bundles, tracking scripts, or backend calls. Login,
signup, payment, and other credential-collection forms are stubbed out as inert
placeholders rather than reproduced functionally — this tool is for design/reference
cloning (landing pages, portfolios, marketing sites), not for replicating another
site's authentication flow.

`clones/` is gitignored since output can be large and is regenerable.

## 💛 Support this project

Antikythera GPT Chat is a solo, open-source project — there's no company, no sales team,
and no SLA behind it yet, just one person building it in the open.

If you'd like to help fund ongoing development, or want to talk about a custom
deployment, integration, or partnership, reach out at **antikytheragptchat@gmail.com**, or
send a contribution directly:

- **Revolut** — [revolut.me/mel3zaui](https://revolut.me/mel3zaui)
- **PayPal** — [paypal.me/MelOzzy](https://paypal.me/MelOzzy)
