# New: animated gear loader + bottom dock

## 1. Animated gear loader (replaces the plain thinking indicator)

Instead of a static logo while waiting for a reply, the thinking bubble now shows a small
rotating gear with four orbiting dots pulsing around it — a nod to the Antikythera
mechanism's gear-train theme, in the same brass/bronze accent color as the rest of the UI.

- Gear icon: continuous smooth rotation (`gear-rotate`, 2.4s per turn)
- Four dots orbit at 90° apart, each pulsing in/out on a staggered delay so they read as
  a wave circling the gear rather than four things blinking in sync
- Same "Thinking hard... / Crunching the details... / Almost there..." text cycles next to
  it as before — only the visual changed

No setup needed — this replaces the old static-logo version automatically.

## 2. Bottom dock

A persistent quick-nav bar: **Home · Chat · Models · Files · Profile**.

| Dock item | Icon | Goes to |
|---|---|---|
| Home | 🏠 | Main chat/composer (the app's default view) |
| Chat | 💬 | Saved chats list (browse/delete past conversations) |
| Models | ⚙️ | New "Models" view — shows which Ollama model is currently answering; admins get a shortcut link into Settings to change it, everyone else just sees what's active |
| Files | 📁 | New "Files" view — a running list of files you've attached in the composer this session (name + time attached), for your own reference |
| Profile | 👤 | Settings (persona, theme, text shortcuts, notification preference) |

It's currently set to show on **narrower screens (≤768px width)** — phones and small
tablets — since on wider screens the sidebar already covers the same navigation and a
second nav bar would be redundant. If you'd rather it show everywhere regardless of screen
size, that's a one-line CSS change (removing the `@media (max-width: 768px)` condition
around `.bottom-dock`) — just say so and I'll flip it.

## What I tested
- Clicking each dock button shows the right view and marks that button active
- The "Models" view correctly shows/hides the admin-only "change this" link based on your
  actual admin status from `/api/session`
- Attaching a file via the composer's `+` button now also logs it into the Files view with
  a timestamp
- The gear loader renders and cleans itself up correctly when a response finishes

## Files touched
- `public/app/app.js` — wired up the dock's click handlers, the Models/Files view content,
  and file-attachment logging (the gear loader markup itself was already in place)
