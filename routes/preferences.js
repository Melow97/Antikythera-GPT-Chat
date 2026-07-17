import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.json(req.session?.preferences || { emailNotifications: false });
});

router.post('/', (req, res) => {
  const { emailNotifications } = req.body || {};
  req.session.preferences = { emailNotifications: Boolean(emailNotifications) };
  res.json({ ok: true });
});

export default router;
