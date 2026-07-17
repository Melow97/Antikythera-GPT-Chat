import express from 'express';
import { listProviders } from '../oauth/providers.js';
import { getConnection, removeConnection } from '../oauth/store.js';

const router = express.Router();

router.get('/', (req, res) => {
  const providers = listProviders().map((p) => {
    const connection = getConnection(p.key);
    return {
      key: p.key,
      label: p.label,
      configured: p.configured,
      connected: Boolean(connection),
      connectedAt: connection?.connectedAt || null,
    };
  });
  res.json(providers);
});

router.post('/:provider/disconnect', (req, res) => {
  removeConnection(req.params.provider);
  res.json({ ok: true });
});

export default router;
