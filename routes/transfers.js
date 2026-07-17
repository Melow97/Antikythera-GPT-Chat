import express from 'express';

const router = express.Router();

// Amadeus for Developers self-service — same free "test" tier as hotels.js, extended to
// their Transfer Search API (airport/hotel transfers) instead of hotel offers.
const AUTH_URL = 'https://test.api.amadeus.com/v1/security/oauth2/token';
const TRANSFER_OFFERS_URL = 'https://test.api.amadeus.com/v1/shopping/transfer-offers';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

// Separate in-memory token cache from hotels.js — small duplication, but keeps each route
// file self-contained the same way hotels.js already is.
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
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

// Amadeus needs a precise destination (address or lat/lng), not just a city name — so a
// destination typed as a plain city name in chat is resolved to coordinates first via the
// same free, keyless Open-Meteo geocoder used for weather lookups.
async function geocodeCity(city, signal) {
  const geoRes = await fetch(`${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`, { signal });
  const geoData = await geoRes.json();
  const match = geoData.results?.[0];
  if (!match) return null;
  return { latitude: match.latitude, longitude: match.longitude, resolvedName: [match.name, match.country].filter(Boolean).join(', ') };
}

// GET /api/transfers/search?from=CDG&to=Paris&datetime=2026-08-01T10:00:00&passengers=2
router.get('/search', async (req, res) => {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(400).json({
      error:
        'AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET are not set on the server. Transfer search reuses ' +
        'the same free Amadeus for Developers self-service app as hotel search — see README.',
    });
  }

  const { from, to } = req.query;
  const datetime = req.query.datetime;
  const passengers = Number(req.query.passengers) || 1;

  if (!from || !to || !datetime) {
    return res.status(400).json({ error: 'from (airport IATA code), to (destination city), and datetime query params are all required.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(datetime)) {
    return res.status(400).json({ error: 'datetime must be in YYYY-MM-DDTHH:MM:SS format.' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const destination = await geocodeCity(to, controller.signal);
      if (!destination) {
        return res.json({ from, to, found: false, reason: `Could not resolve "${to}" to a location.` });
      }

      const token = await getAccessToken(clientId, clientSecret);
      const offersRes = await fetch(TRANSFER_OFFERS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startLocationCode: from.toUpperCase(),
          endGeoCode: `${destination.latitude},${destination.longitude}`,
          startDateTime: datetime,
          passengers,
          transferType: 'PRIVATE',
        }),
        signal: controller.signal,
      });

      const rawBody = await offersRes.text();
      let data;
      try {
        data = JSON.parse(rawBody);
      } catch {
        return res.status(502).json({
          error: `Amadeus transfer-offers returned a non-JSON response (HTTP ${offersRes.status}).`,
          details: rawBody.slice(0, 300),
        });
      }

      if (!offersRes.ok) {
        return res.status(offersRes.status).json({
          error: data.errors?.[0]?.detail || 'Amadeus transfer-offers API error',
          details: data,
        });
      }

      const transfers = (data.data || [])
        .map((offer) => ({
          vehicleType: offer.vehicle?.description || offer.vehicle?.category || 'Vehicle',
          provider: offer.serviceProvider?.name || null,
          price: offer.quotation?.monetaryAmount,
          currency: offer.quotation?.currencyCode,
          durationMinutes: offer.transfer?.duration ? Number(offer.transfer.duration.replace(/[^\d]/g, '')) || null : null,
        }))
        // Cheapest first, same as hotels — sort before slicing.
        .sort((a, b) => (parseFloat(a.price) || Infinity) - (parseFloat(b.price) || Infinity))
        .slice(0, 5);

      res.json({
        from: from.toUpperCase(),
        to: destination.resolvedName,
        datetime,
        passengers,
        found: true,
        transfers,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Transfer search timed out after 15 seconds.' });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
