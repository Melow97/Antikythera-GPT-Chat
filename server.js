import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import FileStoreFactory from 'session-file-store';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import chatRouter from './routes/chat.js';
import connectionsRouter from './routes/connections.js';
import authRouter from './routes/auth.js';
import searchRouter from './routes/search.js';
import flightsRouter from './routes/flights.js';
import hotelsRouter from './routes/hotels.js';
import transfersRouter from './routes/transfers.js';
import weatherRouter from './routes/weather.js';
import currencyRouter from './routes/currency.js';
import tripadvisorRouter from './routes/tripadvisor.js';
import loginRouter from './routes/login.js';
import preferencesRouter from './routes/preferences.js';
import adminRouter from './routes/admin.js';
import tripitRouter from './routes/tripit.js';
import { getAdminSettings } from './lib/adminSettings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FileStore = FileStoreFactory(session);

const app = express();
const PORT = process.env.PORT || 3000;

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret-change-me';
if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not set in .env — using an insecure default. Fine for local testing only.');
}

function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  res.redirect('/');
}

function isAdminUser(user) {
  return Boolean(user && process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL);
}

function requireAdmin(req, res, next) {
  if (isAdminUser(req.session?.user)) return next();
  res.status(403).json({ error: 'Admin access only.' });
}

// Behind a reverse proxy (Render/Railway/Fly/etc.), this makes Express trust the
// X-Forwarded-Proto header so `cookie.secure: 'auto'` below and req.ip work correctly.
app.set('trust proxy', 1);

app.use(
  helmet({
    // The app's own pages use inline <style> blocks and no external script CDNs, so a
    // fully strict default-src would break them. This keeps the other protections
    // (frame-ancestors, HSTS, X-Content-Type-Options, etc.) while allowing same-origin
    // scripts/styles plus the inline styles already used on these pages.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
      },
    },
  })
);

app.use(express.json({ limit: '5mb' }));
app.use(
  session({
    store: new FileStore({ path: path.join(__dirname, 'data', 'sessions'), logFn: () => {} }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto' },
  })
);

app.get('/', (req, res) => {
  if (req.session?.user) return res.redirect('/app');
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.get('/api/session', (req, res) => {
  const user = req.session?.user || null;
  res.json({ user, isAdmin: isAdminUser(user), defaultModel: getAdminSettings().defaultModel });
});

app.get('/api/announcement', requireAuth, (req, res) => {
  res.json({ announcement: getAdminSettings().announcement });
});

app.use('/login', loginRouter);

app.use('/app', requireAuth, express.static(path.join(__dirname, 'public', 'app')));
app.use('/api/chat', requireAuth, chatRouter);
app.use('/api/connections', requireAuth, connectionsRouter);
app.use('/api/search', requireAuth, searchRouter);
app.use('/api/flights', requireAuth, flightsRouter);
app.use('/api/hotels', requireAuth, hotelsRouter);
app.use('/api/transfers', requireAuth, transfersRouter);
app.use('/api/weather', requireAuth, weatherRouter);
app.use('/api/currency', requireAuth, currencyRouter);
app.use('/api/tripadvisor', requireAuth, tripadvisorRouter);
app.use('/api/preferences', requireAuth, preferencesRouter);
app.use('/api/admin', requireAuth, requireAdmin, adminRouter);
// TripIt uses OAuth 1.0a and has its own start/callback router — mounted at the more
// specific /auth/tripit path BEFORE the generic /auth OAuth 2.0 router so it takes
// precedence for that provider.
app.use('/auth/tripit', requireAuth, tripitRouter);
app.use('/auth', requireAuth, authRouter);

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Antikythera GPT Chat running at http://localhost:${PORT}`);
});
