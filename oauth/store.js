// Local, single-user token store. Tokens are written to data/connections.json (gitignored),
// encrypted at rest with AES-256-GCM using a key derived from ENCRYPTION_KEY in .env —
// fine for local dev/personal use, swap for a real encrypted database before any
// multi-user deployment.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const storePath = path.join(dataDir, 'connections.json');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'dev-insecure-encryption-key-change-me';
if (!process.env.ENCRYPTION_KEY) {
  console.warn('ENCRYPTION_KEY is not set in .env — connections.json will be encrypted with an insecure default key. Fine for local testing only.');
}
// scrypt derives a fixed-length 32-byte key from any passphrase string. The salt is
// static (not secret) — its only job is to make the derived key AES-256-compatible.
const key = crypto.scryptSync(ENCRYPTION_KEY, 'antikythera-connections-store', 32);

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: encrypted.toString('hex'),
  };
}

function decrypt({ iv, tag, data }) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

function readStore() {
  if (!fs.existsSync(storePath)) return {};
  try {
    const envelope = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    return JSON.parse(decrypt(envelope));
  } catch {
    return {};
  }
}

function writeStore(data) {
  fs.mkdirSync(dataDir, { recursive: true });
  const envelope = encrypt(JSON.stringify(data));
  fs.writeFileSync(storePath, JSON.stringify(envelope, null, 2), 'utf8');
}

export function getConnection(provider) {
  return readStore()[provider] || null;
}

export function setConnection(provider, tokenData) {
  const store = readStore();
  store[provider] = { ...tokenData, connectedAt: new Date().toISOString() };
  writeStore(store);
}

export function removeConnection(provider) {
  const store = readStore();
  delete store[provider];
  writeStore(store);
}

export function listConnections() {
  return readStore();
}
