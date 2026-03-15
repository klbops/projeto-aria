const router = require('express').Router();

// Placeholder — pode ser expandido com JWT / Google OAuth
router.get('/status', (req, res) => {
  res.json({ authenticated: true, user: 'admin' });
});

module.exports = router;
