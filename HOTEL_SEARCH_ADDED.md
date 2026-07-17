# Added: real hotel search (the follow-up I offered)

Following up on the Booking.com/hotel question from last round — I said Booking.com and
Skyscanner both require a manual partner approval (no self-serve key), and offered Amadeus's
self-service Hotel API as the honest alternative. Built it.

## What it does

New **🏨 Hotels** toggle next to Flights. Phrase your message with a 3-letter city code and
two dates — *"hotels in PAR from 2026-08-01 to 2026-08-03"* — and it:

1. Authenticates to Amadeus (OAuth2 client-credentials — cached in memory so it's not
   re-authenticating on every single request, tokens last ~30 minutes)
2. Looks up hotel IDs in that city
3. Pulls live offers for those hotels
4. Shows a results card immediately (hotel name, star rating, room type, price) plus a
   "Compare & book on Booking.com ↗" link, independent of the model's text reply

## The honest limitation

Amadeus's free self-service tier runs against their **test environment** — real API shape
and real request/response logic, but a **sample dataset**, not full live production
inventory. That's different from Kiwi's flight API, which does return live real fares on
the free tier. I built the card's copy to say this plainly (both to you and baked into what
the model is told to say), and pointed the booking link at a real Booking.com search instead
of pretending the sample data is bookable as-is.

If you want genuinely live hotel inventory later, the honest paths are: Amadeus's
production-tier upgrade (self-service, but higher-volume/business use terms apply), or
actually applying to Booking.com's or Skyscanner's partner programs (manual approval,
not something I can shortcut for you).

## What I actually tested
- Backend error paths: missing credentials, missing query params, and a bad date format all
  return clean 400s, not crashes
- **Full chained logic with mocked Amadeus responses** — this matters because the real
  Amadeus API isn't reachable from my sandbox, so I verified the actual code path (auth →
  city lookup → hotel offers → mapping to the simplified shape) works correctly end-to-end,
  not just that the request URLs look right
- **Token caching** — confirmed two back-to-back searches only trigger one auth call, not two
- Query parser: handles the dates given in either order (check-in/check-out swapped in the
  sentence still resolves correctly), and correctly returns nothing for a vague message
- Full UI flow with a mocked search response: the card appears immediately with the right
  hotel names/prices/booking link, **and — this was the same bug class I caught with
  flights last round — I specifically re-tested that the card survives the re-render that
  happens once the model's reply arrives**, since that's exactly what broke silently before
  I fixed it. It holds.

## Setup
```
AMADEUS_CLIENT_ID=your-client-id
AMADEUS_CLIENT_SECRET=your-client-secret
```
Free signup at https://developers.amadeus.com/register, then restart the server.
