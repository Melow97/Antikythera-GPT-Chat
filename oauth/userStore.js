// Local, single-file user store for email/password accounts. Written to
// data/users.json (gitignored) — fine for local dev/personal use, swap for a real
// database with proper encryption-at-rest before any multi-user deployment.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const storePath = path.join(dataDir, 'users.json');

function readStore() {
  if (!fs.existsSync(storePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(storePath, 'utf8'));
  } catch {
    return [];
  }
}

function writeStore(users) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(users, null, 2), 'utf8');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

export function findUserByEmail(email) {
  const normalized = normalizeEmail(email);
  return readStore().find((u) => u.email === normalized) || null;
}

export function listUsers() {
  return readStore();
}

export function findUserByResetToken(token) {
  if (!token) return null;
  return readStore().find((u) => u.resetToken === token && u.resetTokenExpiry > Date.now()) || null;
}

export function createUser({ email, passwordHash, firstName, lastName }) {
  const users = readStore();
  const user = {
    id: crypto.randomUUID(),
    email: normalizeEmail(email),
    passwordHash,
    firstName,
    lastName,
    emailVerified: false,
    verifyCode: generateCode(),
    verifyCodeExpiry: Date.now() + 10 * 60 * 1000,
    resetToken: null,
    resetTokenExpiry: null,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeStore(users);
  return user;
}

export function updateUser(id, patch) {
  const users = readStore();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return null;
  users[index] = { ...users[index], ...patch };
  writeStore(users);
  return users[index];
}

export function setVerifyCode(id) {
  return updateUser(id, {
    verifyCode: generateCode(),
    verifyCodeExpiry: Date.now() + 10 * 60 * 1000,
  });
}

export function setResetToken(id) {
  return updateUser(id, {
    resetToken: crypto.randomBytes(32).toString('hex'),
    resetTokenExpiry: Date.now() + 60 * 60 * 1000,
  });
}
