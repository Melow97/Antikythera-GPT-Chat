import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import {
  findUserByEmail,
  createUser,
  findUserByResetToken,
  updateUser,
  setVerifyCode,
  setResetToken,
} from '../oauth/userStore.js';
import { sendEmail } from '../lib/email.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// Blocks brute-force/credential-stuffing against email+password auth. Keyed by IP,
// so a single attacker can't just retry past it, but normal users retyping a typo'd
// password a few times never notice it.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

// Looser, separate limiter for password-reset requests — protects against someone
// using the form to spam an inbox with reset emails.
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reset requests. Please wait a while and try again.' },
});

// Rotates the session ID before assigning req.session.user, so an authenticated
// session never reuses an ID an attacker may have seen pre-login (session fixation).
function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

router.post('/signup', authLimiter, async (req, res) => {
  const { email, password, firstName, lastName } = req.body || {};

  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (!firstName || !String(firstName).trim()) {
    return res.status(400).json({ error: 'First name is required.' });
  }
  if (!lastName || !String(lastName).trim()) {
    return res.status(400).json({ error: 'Last name is required.' });
  }

  if (findUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with this email already exists. Try logging in instead.' });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = createUser({
    email,
    passwordHash,
    firstName: String(firstName).trim().slice(0, 80),
    lastName: String(lastName).trim().slice(0, 80),
  });

  // Signup does not log the user in yet — a code is emailed and /verify-code must
  // succeed first, so a stolen/typo'd email can't be used to create a working account.
  await sendEmail({
    to: user.email,
    subject: `${user.verifyCode} is your Antikythera GPT Chat verification code`,
    html: `
      <p>Hi ${user.firstName},</p>
      <p>Your verification code is:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${user.verifyCode}</p>
      <p>Enter this on the sign-up page to finish creating your account. It expires in 10
      minutes. If you didn't sign up, you can ignore this email.</p>
    `,
  });

  res.json({ ok: true, requiresVerification: true, email: user.email });
});

router.post('/verify-code', authLimiter, async (req, res) => {
  const { email, code } = req.body || {};

  if (!email || !code) {
    return res.status(400).json({ error: 'Enter the code from your email.' });
  }

  const user = findUserByEmail(email);
  const genericError = 'That code is incorrect or expired.';
  if (!user || user.emailVerified) {
    return res.status(400).json({ error: genericError });
  }
  if (user.verifyCode !== String(code).trim() || user.verifyCodeExpiry < Date.now()) {
    return res.status(400).json({ error: genericError });
  }

  updateUser(user.id, { emailVerified: true, verifyCode: null, verifyCodeExpiry: null });

  await regenerateSession(req);
  req.session.user = {
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    picture: null,
  };
  res.json({ ok: true });
});

router.post('/resend-code', forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body || {};
  const user = email && findUserByEmail(email);

  // Same response whether or not the account exists / is already verified, so this
  // can't be used to probe which emails have accounts.
  if (user && !user.emailVerified) {
    const updated = setVerifyCode(user.id);
    await sendEmail({
      to: user.email,
      subject: `${updated.verifyCode} is your Antikythera GPT Chat verification code`,
      html: `
        <p>Hi ${user.firstName},</p>
        <p>Your new verification code is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${updated.verifyCode}</p>
        <p>It expires in 10 minutes.</p>
      `,
    });
  }

  res.json({ ok: true, message: "If that email needs verifying, we've sent a new code." });
});

router.post('/local', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Enter your email and password.' });
  }

  const user = findUserByEmail(email);
  const genericError = 'Incorrect email or password.';
  if (!user) {
    return res.status(401).json({ error: genericError });
  }

  const matches = await bcrypt.compare(String(password), user.passwordHash);
  if (!matches) {
    return res.status(401).json({ error: genericError });
  }

  if (!user.emailVerified) {
    return res.status(403).json({
      error: 'Verify your email before logging in.',
      requiresVerification: true,
      email: user.email,
    });
  }

  await regenerateSession(req);
  req.session.user = {
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    picture: null,
  };
  res.json({ ok: true });
});

router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body || {};
  // Always return the same response whether or not the email exists — otherwise this
  // endpoint becomes a way to check which emails have accounts.
  const genericResponse = { ok: true, message: "If that email has an account, we've sent a reset link." };

  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  const user = findUserByEmail(email);
  if (user) {
    const updated = setResetToken(user.id);
    const resetLink = `${BASE_URL}/reset-password.html?token=${updated.resetToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Reset your password — Antikythera GPT Chat',
      html: `
        <p>Hi ${user.firstName},</p>
        <p>Someone requested a password reset for this account. Reset it here:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>This link expires in 1 hour. If you didn't request this, you can ignore this email —
        your password won't change.</p>
      `,
    });
  }

  res.json(genericResponse);
});

router.post('/reset-password', authLimiter, async (req, res) => {
  const { token, password } = req.body || {};

  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const user = findUserByResetToken(token);
  if (!user) {
    return res.status(400).json({ error: 'That reset link is invalid or expired. Request a new one.' });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  updateUser(user.id, { passwordHash, resetToken: null, resetTokenExpiry: null });
  res.json({ ok: true });
});

const REDIRECT_URI = `${BASE_URL}/login/google/callback`;

router.get('/google/start', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.redirect('/?error=' + encodeURIComponent('Google sign-in is not configured (missing GOOGLE_CLIENT_ID in .env).'));
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.redirect('/?error=' + encodeURIComponent(String(error)));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return res.redirect('/?error=' + encodeURIComponent('Google sign-in failed during token exchange.'));
    }

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileResponse.json();

    await regenerateSession(req);
    req.session.user = {
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    };
    res.redirect('/app');
  } catch (err) {
    res.redirect('/?error=' + encodeURIComponent('Google sign-in failed.'));
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

export default router;
