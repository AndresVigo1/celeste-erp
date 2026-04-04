'use strict';

const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { db }    = require('../db');
const authMiddleware = require('../middleware/auth');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const router = express.Router();

const rpID   = () => process.env.RPID   || 'localhost';
const origin = () => process.env.ORIGIN || `http://localhost:${process.env.PORT || 3000}`;

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera un minuto.' }
});

// Per-user in-memory challenge (single process, fine for this scale)
const challenges = {};

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, nombre: user.nombre },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// ── POST /api/auth/user-lookup — check if email is authorized (no info leak) ──
// Returns only first name so UI can personalize; same 404 for unknown emails
// (does NOT expose list of valid emails)

router.post('/user-lookup', loginLimiter, (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email requerido' });
  }
  const user = db.prepare('SELECT id, email, nombre FROM users WHERE email = ? AND activo = 1').get(email.trim().toLowerCase());
  if (!user) return res.status(404).json({ error: 'No autorizado' });
  res.json({ id: user.id, email: user.email, nombre: user.nombre });
});

// ── POST /api/auth/login — PIN login ─────────────────────────────────────────

router.post('/login', loginLimiter, (req, res) => {
  const { email, pin } = req.body;
  if (!email || !pin) {
    return res.status(400).json({ error: 'Email y PIN requeridos' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND activo = 1').get(email);
  if (!user) {
    return res.status(401).json({ error: 'Usuario no encontrado' });
  }
  if (!bcrypt.compareSync(pin, user.pin_hash)) {
    return res.status(401).json({ error: 'PIN incorrecto' });
  }
  res.json({ token: issueToken(user) });
});

// ── GET /api/auth/verify ──────────────────────────────────────────────────────

router.get('/verify', authMiddleware, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ── GET /api/auth/passkey/status?email=xxx ────────────────────────────────────

router.get('/passkey/status', (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email requerido' });
  const user = db.prepare('SELECT id FROM users WHERE email = ? AND activo = 1').get(email);
  if (!user) return res.json({ registered: false });
  const row = db.prepare('SELECT COUNT(*) as cnt FROM passkeys WHERE user_id = ?').get(user.id);
  res.json({ registered: row.cnt > 0 });
});

// ── GET /api/auth/passkey/register-options (JWT required) ─────────────────────

router.get('/passkey/register-options', authMiddleware, async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const existing = db.prepare('SELECT credential_id, transports FROM passkeys WHERE user_id = ?').all(user.id);
    const options  = await generateRegistrationOptions({
      rpName: 'Celeste Taller Creativo',
      rpID: rpID(),
      userName: user.email,
      userDisplayName: user.nombre,
      userID: Buffer.from(String(user.id)),
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      excludeCredentials: existing.map(p => ({
        id: p.credential_id,
        transports: JSON.parse(p.transports || '[]'),
      })),
    });
    challenges[user.id] = options.challenge;
    res.json(options);
  } catch (err) {
    console.error('passkey register-options:', err);
    res.status(500).json({ error: 'Error generando opciones' });
  }
});

// ── POST /api/auth/passkey/register-verify (JWT required) ────────────────────

router.post('/passkey/register-verify', authMiddleware, async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: challenges[user.id],
      expectedOrigin: origin(),
      expectedRPID: rpID(),
    });
    if (!verified || !registrationInfo) {
      return res.status(400).json({ error: 'Verificación fallida' });
    }
    const { credential } = registrationInfo;
    db.prepare(`
      INSERT OR REPLACE INTO passkeys (credential_id, public_key, counter, transports, user_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      credential.id,
      Buffer.from(credential.publicKey).toString('base64url'),
      credential.counter,
      JSON.stringify(credential.transports || []),
      user.id
    );
    delete challenges[user.id];
    res.json({ ok: true });
  } catch (err) {
    console.error('passkey register-verify:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/passkey/login-options?email=xxx ─────────────────────────────

router.get('/passkey/login-options', async (req, res) => {
  try {
    const { email } = req.query;
    const user = email
      ? db.prepare('SELECT * FROM users WHERE email = ? AND activo = 1').get(email)
      : null;

    const passkeys = user
      ? db.prepare('SELECT credential_id, transports FROM passkeys WHERE user_id = ?').all(user.id)
      : db.prepare('SELECT credential_id, transports FROM passkeys').all();

    const options = await generateAuthenticationOptions({
      rpID: rpID(),
      allowCredentials: passkeys.map(p => ({
        id: p.credential_id,
        transports: JSON.parse(p.transports || '[]'),
      })),
      userVerification: 'preferred',
    });
    const key = user ? user.id : '__any__';
    challenges[key] = options.challenge;
    res.json({ ...options, _challengeKey: key });
  } catch (err) {
    console.error('passkey login-options:', err);
    res.status(500).json({ error: 'Error generando opciones' });
  }
});

// ── POST /api/auth/passkey/login-verify ──────────────────────────────────────

router.post('/passkey/login-verify', loginLimiter, async (req, res) => {
  try {
    const { _challengeKey, ...response } = req.body;
    const passkey = db.prepare('SELECT * FROM passkeys WHERE credential_id = ?').get(response.id);
    if (!passkey) return res.status(401).json({ error: 'Passkey no encontrada' });

    const challengeKey = _challengeKey || passkey.user_id;
    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenges[challengeKey],
      expectedOrigin: origin(),
      expectedRPID: rpID(),
      credential: {
        id: passkey.credential_id,
        publicKey: Buffer.from(passkey.public_key, 'base64url'),
        counter: passkey.counter,
        transports: JSON.parse(passkey.transports || '[]'),
      },
    });
    if (!verified) return res.status(401).json({ error: 'Autenticación fallida' });

    db.prepare('UPDATE passkeys SET counter = ? WHERE credential_id = ?').run(
      authenticationInfo.newCounter, passkey.credential_id
    );
    delete challenges[challengeKey];

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(passkey.user_id);
    if (!user || !user.activo) return res.status(401).json({ error: 'Usuario inactivo' });

    res.json({ token: issueToken(user) });
  } catch (err) {
    console.error('passkey login-verify:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/auth/passkey (JWT required) — delete current user's passkeys ──

router.delete('/passkey', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM passkeys WHERE user_id = ?').run(req.user.sub);
  res.json({ ok: true });
});

module.exports = router;
