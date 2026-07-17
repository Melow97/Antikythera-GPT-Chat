import express from 'express';
import { isTripitConfigured, getRequestToken, getAuthorizeUrl, getAccessToken } from '../oauth/tripit.js';
import { setConnection } from '../oauth/store.js';

const router = express.Router();

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const CALLBACK_URL = `${BASE_URL}/auth/tripit/callback`;

// TripIt's 3-legged OAuth 1.0a needs the request-token secret again at the access-token
// step, but the redirect back from TripIt only carries oauth_token — so the secret has to
// be held server-side, keyed by token, across that redirect. Short-lived, same spirit as
// the CSRF state map in routes/auth.js.
const pendingRequestTokens = new Map();

router.get('/start', async (req, res) => {
  if (!isTripitConfigured()) {
    return res
      .status(400)
      .send('TripIt is not configured. Set TRIPIT_CONSUMER_KEY and TRIPIT_CONSUMER_SECRET in your .env file.');
  }

  try {
    const { token, tokenSecret } = await getRequestToken(CALLBACK_URL);
    pendingRequestTokens.set(token, { tokenSecret, expiresAt: Date.now() + 10 * 60 * 1000 });
    res.redirect(getAuthorizeUrl(token, CALLBACK_URL));
  } catch (err) {
    res.status(500).send(`TripIt request token error: ${err.message}`);
  }
});

router.get('/callback', async (req, res) => {
  const { oauth_token: token, not_authorized: notAuthorized } = req.query;

  if (notAuthorized) {
    return res.redirect('/#connections');
  }

  const pending = pendingRequestTokens.get(token);
  if (!pending || pending.expiresAt < Date.now()) {
    return res.status(400).send('Invalid or expired TripIt request token. Please try connecting again.');
  }
  pendingRequestTokens.delete(token);

  try {
    const { token: accessToken, tokenSecret: accessTokenSecret } = await getAccessToken(token, pending.tokenSecret);

    setConnection('tripit', { accessToken, accessTokenSecret });

    res.redirect('/#connections');
  } catch (err) {
    res.status(500).send(`TripIt access token error: ${err.message}`);
  }
});

export default router;
