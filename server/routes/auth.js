'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { get } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Rate limit: 5 attempts per minute on login
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera un minuto e intenta de nuevo.' }
});

/**
 * POST /api/auth/login
 * Body: { pin: "123456" }
 * Returns: { token }
 */
router.post('/login', loginLimiter, (req, res) => {
  const { pin } = req.body;

  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({ error: 'PIN requerido' });
  }

  const row = get("SELECT valor FROM config WHERE clave = 'pin_hash'");
  if (!row) {
    return res.status(500).json({ error: 'Configuración de PIN no encontrada. Ejecuta npm run db:init' });
  }

  const valid = bcrypt.compareSync(pin, row.valor);
  if (!valid) {
    return res.status(401).json({ error: 'PIN incorrecto' });
  }

  const token = jwt.sign(
    { sub: 'owner', negocio: 'Celeste Taller Creativo' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ token });
});

/**
 * GET /api/auth/verify
 * Returns { ok: true } if token is valid.
 */
router.get('/verify', authMiddleware, (req, res) => {
  res.json({ ok: true, user: req.user });
});

module.exports = router;
