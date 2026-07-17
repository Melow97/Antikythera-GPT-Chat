import express from 'express';

const router = express.Router();

// open.er-api.com — the fully open, keyless tier of exchangerate-api.com. Rates update
// roughly daily, which is plenty for budgeting/trip-planning use, not real-time trading.
const BASE_URL = 'https://open.er-api.com/v6/latest';

const CODE_RE = /^[A-Za-z]{3}$/;

// GET /api/currency/convert?amount=100&from=USD&to=EUR
router.get('/convert', async (req, res) => {
  const { amount, from, to } = req.query;
  const amountNum = Number(amount);

  if (!amount || Number.isNaN(amountNum) || amountNum < 0) {
    return res.status(400).json({ error: 'amount must be a positive number.' });
  }
  if (!from || !CODE_RE.test(from) || !to || !CODE_RE.test(to)) {
    return res.status(400).json({ error: 'from and to must be 3-letter currency codes (e.g. USD, EUR).' });
  }

  const fromCode = from.toUpperCase();
  const toCode = to.toUpperCase();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${BASE_URL}/${fromCode}`, { signal: controller.signal });
      const data = await response.json();

      if (!response.ok || data.result !== 'success') {
        return res.status(502).json({ error: data['error-type'] || 'Currency conversion lookup failed.' });
      }

      const rate = data.rates?.[toCode];
      if (!rate) {
        return res.status(400).json({ error: `Unknown or unsupported currency code: ${toCode}` });
      }

      res.json({
        amount: amountNum,
        from: fromCode,
        to: toCode,
        rate,
        converted: Math.round(amountNum * rate * 100) / 100,
        asOf: data.time_last_update_utc || null,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Currency lookup timed out after 10 seconds.' });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
