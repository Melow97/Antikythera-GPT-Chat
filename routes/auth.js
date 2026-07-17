import express from 'express';
import crypto from 'node:crypto';
import { getProviderConfig } from '../oauth/providers.js';
import { setConnection } from '../oauth/store.js';

const router = express.Router();

// short-lived CSRF state tokens; fine for a single local-dev-user process
const pendingStates = new Map();

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

function redirectUriFor(provider) {
  return `${BASE_URL}/auth/${provider}/callback`;
}

router.get('/:provider/start', (req, res) => {
  const provider = req.params.provider;
  const config = getProviderConfig(provider);
  if (!config) return res.status(404).send('Unknown provider');
  if (!config.configured) {
    return res
      .status(400)
      .send(`${config.label} is not configured. Set ${config.clientIdEnv} and ${config.clientSecretEnv} in your .env file.`);
  }

  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, { provider, expiresAt: Date.now() + 10 * 60 * 1000 });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUriFor(provider),
    response_type: 'code',
    state,
    ...(config.scope ? { scope: config.scope } : {}),
    ...config.extraAuthParams,
  });

  res.redirect(`${config.authUrl}?${params.toString()}`);
});

router.get('/:provider/callback', async (req, res) => {
  const provider = req.params.provider;
  const config = getProviderConfig(provider);
  if (!config) return res.status(404).send('Unknown provider');

  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`Authorization failed: ${error}`);

  const pending = pendingStates.get(state);
  if (!pending || pending.provider !== provider || pending.expiresAt < Date.now()) {
    return res.status(400).send('Invalid or expired OAuth state. Please try connecting again.');
  }
  pendingStates.delete(state);

  try {
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUriFor(provider),
    });

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };

    if (config.tokenAuthStyle === 'basic') {
      const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
      headers.Authorization = `Basic ${basic}`;
    } else {
      tokenBody.set('client_id', config.clientId);
      tokenBody.set('client_secret', config.clientSecret);
    }

    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body: tokenBody.toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      return res.status(400).send(`Token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    setConnection(provider, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      expiresIn: tokenData.expires_in || null,
      scope: tokenData.scope || config.scope,
    });

    res.redirect('/#connections');
  } catch (err) {
    res.status(500).send(`Token exchange error: ${err.message}`);
  }
});

export default router;
