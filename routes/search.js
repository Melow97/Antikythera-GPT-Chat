import express from 'express';

const router = express.Router();

// Ollama's own web search — https://ollama.com/api/web_search. This needs a free
// Ollama account API key (the same OLLAMA_API_KEY used for Cloud/"Turbo" chat, if you use
// that), but the search endpoint itself always lives at ollama.com regardless of whether
// your chat model is running locally or in the cloud. See README for the local-chat caveat.
router.post('/', async (req, res) => {
  const { query } = req.body || {};
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'query is required' });
  }

  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      error:
        'OLLAMA_API_KEY is not set on the server. Web search needs a free Ollama account API key ' +
        '(ollama.com/settings/keys), even if your chat model runs locally — see README.',
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    let response;
    try {
      response = await fetch('https://ollama.com/api/web_search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ query, max_results: 6 }),
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
        error: `Ollama web search returned a non-JSON response (HTTP ${response.status}).`,
        details: rawBody.slice(0, 300),
      });
    }

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: data.error || 'Ollama web search API error', details: data });
    }

    // Mapped to the same {title, url, description} shape the frontend already expects,
    // so no changes are needed in app.js.
    const results = (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      description: r.content,
    }));
    res.json({ results });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Ollama web search timed out after 12 seconds.' });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
