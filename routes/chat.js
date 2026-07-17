import express from 'express';
import { getAdminSettings } from '../lib/adminSettings.js';

const router = express.Router();

// Ollama only — local install needs no key. If OLLAMA_API_KEY is set (Ollama Cloud /
// "Turbo") and no explicit OLLAMA_BASE_URL is given, default to ollama.com's hosted
// endpoint instead of localhost.
const ENDPOINT = (() => {
  const base = process.env.OLLAMA_BASE_URL || (process.env.OLLAMA_API_KEY ? 'https://ollama.com' : 'http://localhost:11434');
  return `${base.replace(/\/+$/, '')}/v1/chat/completions`;
})();

router.post('/', async (req, res) => {
  const { messages, systemPrompt } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const apiKey = process.env.OLLAMA_API_KEY || null;
  const chatMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: getAdminSettings().defaultModel,
        max_tokens: 2048,
        messages: chatMessages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Upstream API error', details: data });
    }

    const reply = data.choices?.[0]?.message?.content || '';
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
