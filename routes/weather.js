import express from 'express';

const router = express.Router();

// Open-Meteo — fully free, no API key/signup at all, unlike every other integration in this
// app. Two calls: geocode the place name to coordinates, then fetch a daily forecast.
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

function weatherCodeToText(code) {
  const map = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
    80: 'Rain showers', 81: 'Rain showers', 82: 'Violent rain showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm with hail',
  };
  return map[code] || 'Unknown conditions';
}

// GET /api/weather/search?place=Paris&date=2026-08-01
router.get('/search', async (req, res) => {
  const { place, date } = req.query;
  if (!place) {
    return res.status(400).json({ error: 'place query param is required.' });
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format.' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const geoRes = await fetch(
        `${GEOCODE_URL}?name=${encodeURIComponent(place)}&count=1&language=en&format=json`,
        { signal: controller.signal }
      );
      const geoData = await geoRes.json();
      const match = geoData.results?.[0];
      if (!match) {
        return res.json({ place, found: false });
      }

      const params = new URLSearchParams({
        latitude: match.latitude,
        longitude: match.longitude,
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        timezone: 'auto',
      });
      if (date) {
        params.set('start_date', date);
        params.set('end_date', date);
      } else {
        params.set('forecast_days', '5');
      }

      const forecastRes = await fetch(`${FORECAST_URL}?${params.toString()}`, { signal: controller.signal });
      const forecastData = await forecastRes.json();
      if (!forecastRes.ok) {
        return res.status(502).json({ error: forecastData.reason || 'Open-Meteo forecast lookup failed.' });
      }

      const daily = forecastData.daily || {};
      const days = (daily.time || []).map((d, i) => ({
        date: d,
        condition: weatherCodeToText(daily.weather_code?.[i]),
        highC: daily.temperature_2m_max?.[i],
        lowC: daily.temperature_2m_min?.[i],
        precipChancePercent: daily.precipitation_probability_max?.[i] ?? null,
      }));

      res.json({
        place,
        found: true,
        resolvedName: [match.name, match.admin1, match.country].filter(Boolean).join(', '),
        days,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Weather lookup timed out after 12 seconds.' });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
