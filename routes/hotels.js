import express from 'express';

const router = express.Router();

// Amadeus for Developers self-service APIs. "test.api" is the free self-serve tier —
// immediate signup, no manual partner approval (unlike Booking.com/Skyscanner), but it's a
// test environment with a smaller/sample dataset rather than full live production inventory.
// Moving to "production.api" for full data is still self-service on Amadeus's side (a
// usage-tier upgrade, not a business approval process), just not wired up here by default.
const AUTH_URL = 'https://test.api.amadeus.com/v1/security/oauth2/token';
const HOTELS_BY_CITY_URL = 'https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city';
const HOTEL_OFFERS_URL = 'https://test.api.amadeus.com/v3/shopping/hotel-offers';

// Simple in-memory token cache — Amadeus tokens last ~30 minutes, no need to fetch a new
// one on every request.
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken(clientId, clientSecret) {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  }).catch((err) => {
    throw new Error(`Could not reach Amadeus's auth server: ${err.message}`);
  });

  const rawBody = await response.text();
  let data;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error(`Amadeus auth returned a non-JSON response (HTTP ${response.status}): ${rawBody.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Amadeus authentication failed');
  }

  cachedToken = data.access_token;
  // Refresh a little early (60s buffer) rather than cutting it exactly at expiry.
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

function bookingSearchLink(city, checkin, checkout) {
  return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city)}&checkin=${checkin}&checkout=${checkout}`;
}

// GET /api/hotels/search?city=PAR&checkin=2026-08-01&checkout=2026-08-03&adults=2
router.get('/search', async (req, res) => {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(400).json({
      error:
        'AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET are not set on the server. Hotel search needs ' +
        'a free Amadeus for Developers self-service app (developers.amadeus.com) — see README.',
    });
  }

  const { city, checkin, checkout } = req.query;
  const adults = Number(req.query.adults) || 1;

  if (!city || !checkin || !checkout) {
    return res.status(400).json({ error: 'city, checkin, and checkout query params are all required.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkin) || !/^\d{4}-\d{2}-\d{2}$/.test(checkout)) {
    return res.status(400).json({ error: 'checkin and checkout must be in YYYY-MM-DD format.' });
  }

  try {
    const token = await getAccessToken(clientId, clientSecret);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      // Step 1: find hotel IDs in this city
      const cityRes = await fetch(
        `${HOTELS_BY_CITY_URL}?cityCode=${encodeURIComponent(city.toUpperCase())}`,
        { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }
      );
      const cityRaw = await cityRes.text();
      let cityData;
      try {
        cityData = JSON.parse(cityRaw);
      } catch {
        return res.status(502).json({
          error: `Amadeus hotel-list lookup returned a non-JSON response (HTTP ${cityRes.status}).`,
          details: cityRaw.slice(0, 300),
        });
      }
      if (!cityRes.ok) {
        return res.status(cityRes.status).json({
          error: cityData.errors?.[0]?.detail || 'Amadeus hotel-list API error',
          details: cityData,
        });
      }

      const hotelIds = (cityData.data || []).slice(0, 20).map((h) => h.hotelId);
      if (hotelIds.length === 0) {
        return res.json({ city, checkin, checkout, hotels: [], bookingUrl: bookingSearchLink(city, checkin, checkout) });
      }

      // Step 2: get live offers for those hotels
      const offersRes = await fetch(
        `${HOTEL_OFFERS_URL}?hotelIds=${hotelIds.join(',')}&checkInDate=${checkin}&checkOutDate=${checkout}&adults=${adults}&currency=EUR&bestRateOnly=true`,
        { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }
      );
      const offersRaw = await offersRes.text();
      let offersData;
      try {
        offersData = JSON.parse(offersRaw);
      } catch {
        return res.status(502).json({
          error: `Amadeus hotel-offers lookup returned a non-JSON response (HTTP ${offersRes.status}).`,
          details: offersRaw.slice(0, 300),
        });
      }
      if (!offersRes.ok) {
        return res.status(offersRes.status).json({
          error: offersData.errors?.[0]?.detail || 'Amadeus hotel-offers API error',
          details: offersData,
        });
      }

      const hotels = (offersData.data || [])
        .filter((entry) => entry.offers?.length)
        .slice(0, 8)
        .map((entry) => {
          const offer = entry.offers[0];
          return {
            name: entry.hotel?.name,
            rating: entry.hotel?.rating || null,
            price: offer.price?.total,
            currency: offer.price?.currency,
            roomType: offer.room?.typeEstimated?.category || offer.room?.description?.text?.slice(0, 60) || null,
            checkin,
            checkout,
          };
        });

      res.json({ city, checkin, checkout, hotels, bookingUrl: bookingSearchLink(city, checkin, checkout) });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Hotel search timed out after 15 seconds.' });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
