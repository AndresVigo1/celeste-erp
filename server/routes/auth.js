'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { get, db } = require('../db');
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

// Rate limit: 5 attempts per minute
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera un minuto e intenta de nuevo.' }
});

// In-memory challenge (single user / single process)
let currentChallenge = null;

// ── PIN Login ─────────────────────────────────────────────────────────────────

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

// ── Verify JWT ────────────────────────────────────────────────────────────────

router.get('/verify', authMiddleware, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ── Passkey: status (public) ──────────────────────────────────────────────────

router.get('/passkey/status', (req, res) => {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM passkeys').get();
  res.json({ registered: row.cnt > 0 });
});

// ── Passkey: register options (requires JWT) ──────────────────────────────────

router.get('/passkey/register-options', authMiddleware, async (req, res) => {
  try {
    const existing = db.prepare('SELECT credential_id, transports FROM passkeys').all();
    const options = await generateRegistrationOptions({
      rpName: 'Celeste Taller Creativo',
      rpID: rpID(),
      userName: 'owner',
      userID: Buffer.from('owner'),
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: existing.map(p => ({
        id: p.credential_id,
        transports: JSON.parse(p.transports || '[]'),
      })),
    });
    currentChallenge = options.challenge;
    res.json(options);
  } catch (err) {
    console.error('passkey register-options:', err);
    res.status(500).json({ error: 'Error generando opciones' });
  }
});

// ── Passkey: register verify (requires JWT) ───────────────────────────────────

router.post('/passkey/register-verify', authMiddleware, async (req, res) => {
  try {
    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: currentChallenge,
      expectedOrigin: origin(),
      expectedRPID: rpID(),
    });
    if (!verified || !registrationInfo) {
      return res.status(400).json({ error: 'Verificación fallida' });
    }
    const { credential } = registrationInfo;
    db.prepare(`
      INSERT OR REPLACE INTO passkeys (credential_id, public_key, counter, transports)
      VALUES (?, ?, ?, ?)
    `).run(
      credential.id,
      Buffer.from(credential.publicKey).toString('base64url'),
      credential.counter,
      JSON.stringify(credential.transports || [])
    );
    currentChallenge = null;
    res.json({ ok: true });
  } catch (err) {
    console.error('passkey register-verify:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Passkey: login options (public) ──────────────────────────────────────────

router.get('/passkey/login-options', async (req, res) => {
  try {
    const passkeys = db.prepare('SELECT credential_id, transports FROM passkeys').all();
    const options = await generateAuthenticationOptions({
      rpID: rpID(),
      allowCredentials: passkeys.map(p => ({
        id: p.credential_id,
        transports: JSON.parse(p.transports || '[]'),
      })),
      userVerification: 'preferred',
    });
    currentChallenge = options.challenge;
    res.json(options);
  } catch (err) {
    console.error('passkey login-options:', err);
    res.status(500).json({ error: 'Error generando opciones' });
  }
});

// ── Passkey: login verify (public) ───────────────────────────────────────────

router.post('/passkey/login-verify', loginLimiter, async (req, res) => {
  try {
    const passkey = db.prepare('SELECT * FROM passkeys WHERE credential_id = ?').get(req.body.id);
    if (!passkey) {
      return res.status(401).json({ error: 'Passkey no encontrada' });
    }
    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: currentChallenge,
      expectedOrigin: origin(),
      expectedRPID: rpID(),
      credential: {
        id: passkey.credential_id,
        publicKey: Buffer.from(passkey.public_key, 'base64url'),
        counter: passkey.counter,
        transports: JSON.parse(passkey.transports || '[]'),
      },
    });
    if (!verified) {
      return res.status(401).json({ error: 'Autenticación fallida' });
    }
    db.prepare('UPDATE passkeys SET counter = ? WHERE credential_id = ?').run(
      authenticationInfo.newCounter,
      passkey.credential_id
    );
    currentChallenge = null;
    const token = jwt.sign(
      { sub: 'owner', negocio: 'Celeste Taller Creativo' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token });
  } catch (err) {
    console.error('passkey login-verify:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Passkey: delete all (requires JWT) ───────────────────────────────────────

router.delete('/passkey', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM passkeys').run();
  res.json({ ok: true });
});

module.exports = router;
