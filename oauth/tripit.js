// TripIt uses OAuth 1.0a, not OAuth 2.0 like every other Connections provider in this app —
// there's no bearer token; every request (including the token exchange itself) is signed
// with HMAC-SHA1 using the consumer secret and, once obtained, the token secret. That's why
// TripIt has its own module and its own router (routes/tripit.js) instead of plugging into
// oauth/providers.js + routes/auth.js's generic OAuth 2.0 flow.

import crypto from 'node:crypto';
import OAuth from 'oauth-1.0a';

const REQUEST_TOKEN_URL = 'https://api.tripit.com/oauth/request_token';
const AUTHORIZE_URL = 'https://www.tripit.com/oauth/authorize';
const ACCESS_TOKEN_URL = 'https://api.tripit.com/oauth/access_token';
const LIST_TRIPS_URL = 'https://api.tripit.com/v1/list/trip/traveler/true/past/false/format/json';

export function isTripitConfigured() {
  return Boolean(process.env.TRIPIT_CONSUMER_KEY && process.env.TRIPIT_CONSUMER_SECRET);
}

function makeOAuth() {
  return new OAuth({
    consumer: {
      key: process.env.TRIPIT_CONSUMER_KEY,
      secret: process.env.TRIPIT_CONSUMER_SECRET,
    },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString, key) {
      return crypto.createHmac('sha1', key).update(baseString).digest('base64');
    },
  });
}

async function signedFetch(requestData, token) {
  const oauth = makeOAuth();
  const authHeader = oauth.toHeader(oauth.authorize(requestData, token));
  const response = await fetch(requestData.url, {
    method: requestData.method,
    headers: { ...authHeader },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`TripIt request to ${requestData.url} failed (HTTP ${response.status}): ${text.slice(0, 300)}`);
  }
  return text;
}

export async function getRequestToken(callbackUrl) {
  const text = await signedFetch({
    url: REQUEST_TOKEN_URL,
    method: 'POST',
    data: { oauth_callback: callbackUrl },
  });
  const parsed = new URLSearchParams(text);
  const token = parsed.get('oauth_token');
  const tokenSecret = parsed.get('oauth_token_secret');
  if (!token || !tokenSecret) {
    throw new Error(`TripIt request_token response missing expected fields: ${text.slice(0, 300)}`);
  }
  return { token, tokenSecret };
}

export function getAuthorizeUrl(requestToken, callbackUrl) {
  const params = new URLSearchParams({ oauth_token: requestToken, oauth_callback: callbackUrl });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function getAccessToken(requestToken, requestTokenSecret) {
  const text = await signedFetch(
    { url: ACCESS_TOKEN_URL, method: 'POST' },
    { key: requestToken, secret: requestTokenSecret }
  );
  const parsed = new URLSearchParams(text);
  const token = parsed.get('oauth_token');
  const tokenSecret = parsed.get('oauth_token_secret');
  if (!token || !tokenSecret) {
    throw new Error(`TripIt access_token response missing expected fields: ${text.slice(0, 300)}`);
  }
  return { token, tokenSecret };
}

export async function listTrips(accessToken, accessTokenSecret) {
  const text = await signedFetch(
    { url: LIST_TRIPS_URL, method: 'GET' },
    { key: accessToken, secret: accessTokenSecret }
  );
  return JSON.parse(text);
}
