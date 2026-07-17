import express from 'express';

const router = express.Router();

const BASE_URL = 'https://api.tequila.kiwi.com/v2/search';

// Kiwi expects DD/MM/YYYY, the rest of this app works in YYYY-MM-DD — convert.
function toKiwiDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function mapFlight(f) {
  const firstRoute = f.route?.[0];
  const lastRoute = f.route?.[f.route.length - 1];
  return {
    from: f.cityFrom,
    fromCode: f.flyFrom,
    to: f.cityTo,
    toCode: f.flyTo,
    airline: firstRoute?.airline || f.airlines?.[0],
    departure: f.local_departure,
    arrival: f.local_arrival,
    stops: (f.route?.length || 1) - 1,
    durationText: formatDuration(f.duration?.total),
    price: f.price,
    currency: 'EUR', // Tequila's default response currency unless a different curr= is requested
    bookingUrl: f.deep_link,
  };
}

// GET /api/flights/search?from=LON&to=NYC&date=2026-08-01
router.get('/search', async (req, res) => {
  const apiKey = process.env.KIWI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      error:
        'KIWI_API_KEY is not set on the server. Flight search needs a free Kiwi.com Tequila API ' +
        'key (tequila.kiwi.com/portal/login) — see README.',
    });
  }

  const { from, to, date } = req.query;
  if (!from || !to || !date) {
    return res.status(400).json({ error: 'from, to, and date query params are all required.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format.' });
  }

  const kiwiDate = toKiwiDate(date);
  const url =
    `${BASE_URL}?fly_from=${encodeURIComponent(from)}&fly_to=${encodeURIComponent(to)}` +
    `&date_from=${kiwiDate}&date_to=${kiwiDate}&curr=EUR&limit=5&sort=price`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    let response;
    try {
      response = await fetch(url, {
        headers: { apikey: apiKey },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const rawBody = await response.text();
    let data;
    try {
      data = JSON.parse(rawBody);
    } catch {
      return res.status(502).json({
        error: `Kiwi Tequila returned a non-JSON response (HTTP ${response.status}).`,
        details: rawBody.slice(0, 300),
      });
    }

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: data.message || data.error || 'Kiwi Tequila API error', details: data });
    }

    const flights = (data.data || []).map(mapFlight);
    res.json({ from, to, date, flights });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Flight search timed out after 12 seconds.' });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
