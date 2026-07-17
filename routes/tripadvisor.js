import express from 'express';

const router = express.Router();

// TripAdvisor Content API — genuinely self-serve (sign up, set a daily budget + billing
// card, get a key immediately), unlike Viator/GetYourGuide which are partner-approval only.
// Free tier: 5,000 calls/month. This is also the realistic source for real photos, since
// Amadeus no longer distributes hotel images through its self-service Hotel API at all.
const BASE_URL = 'https://api.content.tripadvisor.com/api/v1';

async function fetchJson(url, signal) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  const rawBody = await response.text();
  let data;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error(`TripAdvisor returned a non-JSON response (HTTP ${response.status}): ${rawBody.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new Error(data.error?.message || `TripAdvisor API error (HTTP ${response.status})`);
  }
  return data;
}

// GET /api/tripadvisor/search?place=Eiffel Tower
router.get('/search', async (req, res) => {
  const apiKey = process.env.TRIPADVISOR_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      error:
        'TRIPADVISOR_API_KEY is not set on the server. Reviews/photos need a free TripAdvisor ' +
        'Content API key (a card on file is required, but the first 5,000 calls/month are free) — see README.',
    });
  }

  const { place } = req.query;
  if (!place) {
    return res.status(400).json({ error: 'place query param is required.' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const searchUrl = `${BASE_URL}/location/search?key=${apiKey}&searchQuery=${encodeURIComponent(place)}&language=en`;
      const searchData = await fetchJson(searchUrl, controller.signal);
      const match = searchData.data?.[0];

      if (!match) {
        return res.json({ place, found: false });
      }

      const locationId = match.location_id;
      const [details, photos, reviews] = await Promise.all([
        fetchJson(`${BASE_URL}/location/${locationId}/details?key=${apiKey}&language=en&currency=USD`, controller.signal).catch(() => null),
        fetchJson(`${BASE_URL}/location/${locationId}/photos?key=${apiKey}&language=en`, controller.signal).catch(() => null),
        fetchJson(`${BASE_URL}/location/${locationId}/reviews?key=${apiKey}&language=en`, controller.signal).catch(() => null),
      ]);

      res.json({
        place,
        found: true,
        name: details?.name || match.name,
        address: details?.address_obj?.address_string || match.address_obj?.address_string || null,
        rating: details?.rating ? Number(details.rating) : null,
        numReviews: details?.num_reviews ? Number(details.num_reviews) : null,
        webUrl: details?.web_url || null,
        photos: (photos?.data || [])
          .slice(0, 5)
          .map((p) => p.images?.large?.url || p.images?.medium?.url || p.images?.original?.url)
          .filter(Boolean),
        reviews: (reviews?.data || []).slice(0, 5).map((r) => ({
          title: r.title || null,
          text: r.text ? r.text.slice(0, 400) : null,
          rating: r.rating ? Number(r.rating) : null,
          author: r.user?.username || 'Anonymous',
          publishedDate: r.published_date || null,
        })),
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'TripAdvisor lookup timed out after 15 seconds.' });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
