// OAuth 2.0 config per provider. Client IDs/secrets come from environment variables —
// never hardcode real credentials here. See .env.example for the required variable names.

export const PROVIDERS = {
  google: {
    label: 'Google (Gmail, Calendar, Drive)',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ].join(' '),
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    tokenAuthStyle: 'body',
  },
  microsoft: {
    label: 'Microsoft (Excel, OneDrive, Outlook)',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: ['offline_access', 'User.Read', 'Files.Read', 'Files.ReadWrite'].join(' '),
    clientIdEnv: 'MICROSOFT_CLIENT_ID',
    clientSecretEnv: 'MICROSOFT_CLIENT_SECRET',
    extraAuthParams: {},
    tokenAuthStyle: 'body',
  },
  github: {
    label: 'GitHub',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: ['repo', 'read:user'].join(' '),
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
    extraAuthParams: {},
    tokenAuthStyle: 'body',
  },
  slack: {
    label: 'Slack',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scope: ['channels:read', 'chat:write', 'users:read'].join(','),
    clientIdEnv: 'SLACK_CLIENT_ID',
    clientSecretEnv: 'SLACK_CLIENT_SECRET',
    extraAuthParams: {},
    tokenAuthStyle: 'body',
    scopeParam: 'scope', // Slack uses comma-separated bot scopes
  },
  zoom: {
    label: 'Zoom',
    authUrl: 'https://zoom.us/oauth/authorize',
    tokenUrl: 'https://zoom.us/oauth/token',
    scope: '',
    clientIdEnv: 'ZOOM_CLIENT_ID',
    clientSecretEnv: 'ZOOM_CLIENT_SECRET',
    extraAuthParams: {},
    tokenAuthStyle: 'basic', // Zoom requires HTTP Basic auth (client_id:client_secret) on the token exchange
  },
  dropbox: {
    label: 'Dropbox',
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    scope: ['account_info.read', 'files.metadata.read', 'files.content.read'].join(' '),
    clientIdEnv: 'DROPBOX_CLIENT_ID',
    clientSecretEnv: 'DROPBOX_CLIENT_SECRET',
    extraAuthParams: { token_access_type: 'offline' },
    tokenAuthStyle: 'body',
  },
  canvas: {
    label: 'Canvas',
    // Canvas is self-hosted per institution — there's no single global endpoint like the
    // other providers, so the base URL (e.g. https://yourschool.instructure.com) comes from
    // its own env var and the auth/token URLs are built from it below.
    baseUrlEnv: 'CANVAS_BASE_URL',
    authPath: '/login/oauth2/auth',
    tokenPath: '/login/oauth2/token',
    scope: '',
    clientIdEnv: 'CANVAS_CLIENT_ID',
    clientSecretEnv: 'CANVAS_CLIENT_SECRET',
    extraAuthParams: {},
    tokenAuthStyle: 'body',
  },
  tripit: {
    label: 'TripIt (flights, hotels & Airbnb bookings)',
    // TripIt uses OAuth 1.0a, not OAuth 2.0 — its connect/callback flow is handled by its
    // own router (routes/tripit.js, mounted at /auth/tripit) rather than the generic
    // OAuth 2.0 flow below. This entry only exists so the Connections page can list it and
    // show whether it's configured.
    oauth1: true,
    clientIdEnv: 'TRIPIT_CONSUMER_KEY',
    clientSecretEnv: 'TRIPIT_CONSUMER_SECRET',
  },
};

export function getProviderConfig(providerKey) {
  const config = PROVIDERS[providerKey];
  if (!config) return null;
  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];

  if (config.baseUrlEnv) {
    const baseUrl = (process.env[config.baseUrlEnv] || '').replace(/\/+$/, '');
    return {
      ...config,
      key: providerKey,
      clientId,
      clientSecret,
      authUrl: baseUrl ? `${baseUrl}${config.authPath}` : null,
      tokenUrl: baseUrl ? `${baseUrl}${config.tokenPath}` : null,
      configured: Boolean(clientId && clientSecret && baseUrl),
    };
  }

  return { ...config, key: providerKey, clientId, clientSecret, configured: Boolean(clientId && clientSecret) };
}

export function listProviders() {
  return Object.keys(PROVIDERS).map((key) => getProviderConfig(key));
}
