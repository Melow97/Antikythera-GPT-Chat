# Fixing "no updates since 2023" — real-time search in PowerShell

## Why it says that
Ollama's `llama3.2` model was trained on data up to a certain point and knows nothing after
that — it's not connected to the internet by default, so it'll tell you its training cutoff
whenever you ask about anything recent. That's normal and expected for any local model.

The fix isn't a smarter model — it's **giving it live search results as part of the
conversation**. That's exactly what Claude/GPT do under the hood: a web search runs first,
the results get pasted into the context, then the model writes its answer using that.

The document you pasted is Ollama's own web search API — good, because it means we don't
need a separate Brave/Google account. It reuses the **same Ollama API key** your app already
has a slot for. I've swapped the app's search feature over to use it.

## What I changed
- **`routes/search.js`** now calls `https://ollama.com/api/web_search` (instead of Brave)
- **`.env.example`** and **README** updated to match — one key covers both

**Important catch:** in this app, `OLLAMA_API_KEY` already does double duty — if it's set,
your *chat itself* switches from your local Ollama install to Ollama's cloud servers. If you
want to keep chatting with your local model but still get web search, you need **both**
lines below in `.env`:
```
OLLAMA_API_KEY=your-key-here
OLLAMA_BASE_URL=http://localhost:11434
```
The second line forces chat back to local even though a key is present. If you're fine with
cloud chat (Ollama "Turbo"), just set the key and leave `OLLAMA_BASE_URL` blank.

## Step by step in PowerShell

You don't need to run any of the API example code from that page directly — that was
Ollama's generic documentation, not something this app needs you to execute. Your app
already has the integration built in; you just need to configure and start it. Here's the
whole process:

### 1. Get a free Ollama API key
1. Go to https://ollama.com/settings/keys in your browser (sign up for a free account if
   you don't have one)
2. Click "Create new key", copy it — it'll look like `sk-...` or similar

### 2. Open your project folder in PowerShell
```powershell
cd "C:\path\to\your\Antikythera-GPT-Chat"
```

### 3. Set up your `.env` file
If you don't already have a `.env` file (only `.env.example`), copy it:
```powershell
Copy-Item .env.example .env
```
Then open `.env` in a text editor (Notepad, VS Code, whatever you have):
```powershell
notepad .env
```
Find these two lines and fill them in:
```
OLLAMA_API_KEY=paste-your-key-here
OLLAMA_BASE_URL=http://localhost:11434
```
(Keep `OLLAMA_BASE_URL` as shown above if you want chat to stay local — see the catch above.)
Save and close.

### 4. Install dependencies (only needed once, or after pulling updates)
```powershell
npm install
```

### 5. Make sure Ollama itself is running (for local chat)
```powershell
ollama serve
```
Leave that running in its own PowerShell window, or skip this if Ollama's already running
as a background app on your machine.

### 6. Start the server
In your project folder, in a **new** PowerShell window:
```powershell
npm start
```
You should see:
```
Antikythera GPT Chat running at http://localhost:3000
```

### 7. Test it in the browser
1. Open http://localhost:3000, sign in
2. In the chat composer, click **🔎 Web search** so it highlights as active
3. Ask something recent: *"What's the latest version of Windows?"* or *"What happened in
   the news today?"*
4. Watch for "Searching the web..." in the thinking indicator
5. The answer should reflect current information, not a 2023 cutoff

### 8. If it doesn't work — quick PowerShell sanity check
This tests your API key directly against Ollama's search API, completely separate from the
app, so you can tell if the problem is your key or the app's plumbing:
```powershell
$env:OLLAMA_API_KEY = "paste-your-key-here"
Invoke-RestMethod -Uri "https://ollama.com/api/web_search" `
  -Method Post `
  -Headers @{ Authorization = "Bearer $env:OLLAMA_API_KEY" } `
  -ContentType "application/json" `
  -Body '{"query":"what is ollama"}'
```
- **Get back JSON with search results** → your key is good; if the app still isn't
  searching, restart `npm start` (env vars are only read at startup) and double-check `.env`
  is saved in the project's root folder, not somewhere else
- **401/403 error** → the key itself is wrong or wasn't copied fully — go back to step 1
- **Nothing / timeout** → check your internet connection or firewall isn't blocking
  `ollama.com`

## What this does NOT do
- It doesn't make the model "always know" things automatically — you (or your prompt) still
  need the Web search toggle switched on per message that needs it
- It adds a couple of seconds of delay while it fetches and reads search results before
  answering
- It's still Ollama doing the writing/reasoning — search just gives it fresher facts to work
  with, the same pattern Claude and ChatGPT use, just wired up manually here instead of built
  into the model provider's backend
