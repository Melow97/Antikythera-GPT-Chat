# Two things fixed/added this round

## 1. Fixed: search results not reading as "current"

**The actual bug:** the web search API call itself was working fine, but the injected
context never told the model *what today's date is* or that the results should override its
own training data. An LLM with an old training cutoff can see a live search result and still
hedge with "as of my last update..." if nothing anchors it to the present. Two fixes:

- The injected context now explicitly states today's real date and says outright that these
  results are more current than the model's own training knowledge, especially for anything
  date-sensitive
- If a search runs but returns zero results, the model is now told that explicitly (before,
  it silently got no context and had no way to know a search even happened)
- Added a 12-second timeout so a hanging request fails fast with a clear error instead of
  leaving the user staring at "Searching the web..." indefinitely

## 2. New: real flight search

Added a **✈️ Flights** toggle next to Web search and Live scores, using
[Kiwi.com's Tequila API](https://tequila.kiwi.com/portal/login) — self-serve free signup, no
partner approval process (unlike Skyscanner or Booking.com's official APIs, which do require
approval — see the honest note below on why hotels aren't wired up the same way yet).

**How it works:** type something like *"flights from LON to NYC on 2026-08-01"* with the
toggle on. The server calls Kiwi's real search API and results appear as their own card
directly in the chat — airline, route, stops, duration, price, and a real "Book ↗" deep link
— independent of whatever the model says. The model also gets the same data as text context
so it can summarize/compare, but the card itself doesn't wait on that.

**Parsing is intentionally simple** (same philosophy as the football scores feature's
"today"/"live" keyword check, not full NLP): it looks for two 3-letter codes joined by
"to"/"-"/"→" followed by a YYYY-MM-DD date within a short distance of each other in your
message. If it can't find all three, it skips the lookup and tells the model to ask you to
rephrase using IATA codes, rather than guessing at airports.

### A bug I caught and fixed while testing this
My first version of the flight card appended it directly to the chat's message container.
Testing it end-to-end (not just eyeballing) turned up a real problem: whenever the app
re-renders the chat (which happens right after the model's reply arrives), it wipes and
rebuilds the whole message list from scratch — so the card was getting silently deleted the
moment the reply showed up. Fixed by attaching the flight results to the actual message
object instead (the same data structure that gets saved to your conversation history), so
it now persists correctly through re-renders and even survives closing/reopening the chat.

### On hotels — what I didn't fake
You asked about booking.com and hotel sites too. I didn't wire that up, and wanted to be
upfront about why: Booking.com and Skyscanner's official APIs require an approved partner
application — there's no self-serve free key like Kiwi's. Two honest paths forward if you
want hotels too:
1. **Amadeus for Developers** has a genuine free-tier self-service Hotel Search API — same
   shape of integration as this flights feature, just a different auth flow (OAuth2 client
   credentials instead of a simple API key). I can build this next if you want it.
2. Apply for Booking.com's/Skyscanner's actual partner programs if you want their specific
   inventory — that's a business step on your end, not something I can shortcut.

## Setup
Add to `.env`:
```
KIWI_API_KEY=your-key-here
```
Get a free key at https://tequila.kiwi.com/portal/login, restart the server, then toggle
"✈️ Flights" on and try a message like the example above.

## What I actually tested (not just wrote and hoped)
- Backend: confirmed clean error responses for a missing API key, missing query params, and
  a malformed date — no crashes on any of them
- Confirmed the query parser correctly extracts origin/destination/date from several natural
  phrasings, and correctly returns nothing for a genuinely vague message ("I wanna check
  flights for a date")
- Ran the full send-message flow with a mocked flight API response: confirmed the card
  renders with the right airline, route, price, and a working "Book ↗" link
- Caught and fixed the re-render bug above by testing the flow all the way through to the
  model's reply arriving, not just the immediate card appearance
- Confirmed the vague-query fallback correctly tells the model to ask for a rephrase, with
  no false-positive card
