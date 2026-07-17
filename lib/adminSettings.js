// Site-wide settings the admin controls: the default Ollama model and an optional
// announcement banner shown to everyone. Written to data/admin-settings.json (gitignored,
// same pattern as the other local JSON stores in this app).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const storePath = path.join(dataDir, 'admin-settings.json');

const DEFAULTS = {
  defaultModel: 'llama3.2',
  announcement: '',
};

export function getAdminSettings() {
  if (!fs.existsSync(storePath)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(storePath, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function updateAdminSettings(patch) {
  const settings = { ...getAdminSettings(), ...patch };
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(settings, null, 2), 'utf8');
  return settings;
}
