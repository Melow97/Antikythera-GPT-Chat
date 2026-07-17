import express from 'express';
import { getAdminSettings, updateAdminSettings } from '../lib/adminSettings.js';
import { listUsers } from '../oauth/userStore.js';
import { listConnections } from '../oauth/store.js';

const router = express.Router();

router.get('/stats', (req, res) => {
  res.json({
    userCount: listUsers().length,
    connectionsCount: Object.keys(listConnections()).length,
  });
});

router.get('/settings', (req, res) => {
  res.json(getAdminSettings());
});

router.post('/settings', (req, res) => {
  const { defaultModel, announcement } = req.body || {};
  const patch = {};
  if (typeof defaultModel === 'string') patch.defaultModel = defaultModel.trim().slice(0, 100) || 'llama3.2';
  if (typeof announcement === 'string') patch.announcement = announcement.trim().slice(0, 500);
  res.json(updateAdminSettings(patch));
});

export default router;
