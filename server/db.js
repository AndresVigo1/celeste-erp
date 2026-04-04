'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'celeste.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema migrations (safe on existing DBs) ──────────────────────────────────

db.exec(`CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  nombre     TEXT NOT NULL,
  pin_hash   TEXT NOT NULL,
  activo     INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS passkeys (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  credential_id TEXT NOT NULL UNIQUE,
  public_key    TEXT NOT NULL,
  counter       INTEGER NOT NULL DEFAULT 0,
  transports    TEXT,
  user_id       INTEGER REFERENCES users(id),
  created_at    TEXT DEFAULT (datetime('now','localtime'))
)`);

// Add user_id column to passkeys if missing (existing installs)
try { db.exec(`ALTER TABLE passkeys ADD COLUMN user_id INTEGER REFERENCES users(id)`); } catch {}

// Orphaned passkeys (no user) are invalid — remove them
db.exec(`DELETE FROM passkeys WHERE user_id IS NULL`);

// Seed the 2 authorized users with default PIN 123456 (runs once per email)
const AUTHORIZED_USERS = [
  { email: 'andresvigo1@hotmail.com', nombre: 'Andrés' },
  { email: 'a.sva.20@outlook.com',   nombre: 'Sva'    },
];
for (const u of AUTHORIZED_USERS) {
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
  if (!exists) {
    const { hashSync } = require('bcryptjs');
    db.prepare('INSERT INTO users (email, nombre, pin_hash) VALUES (?, ?, ?)').run(
      u.email, u.nombre, hashSync('123456', 10)
    );
    console.log(`  → Usuario creado: ${u.email}`);
  }
}

// ── Cursos ────────────────────────────────────────────────────────────────────

db.exec(`CREATE TABLE IF NOT EXISTS cursos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre       TEXT NOT NULL,
  descripcion  TEXT,
  fecha_inicio TEXT NOT NULL,
  fecha_fin    TEXT,
  precio       REAL NOT NULL DEFAULT 0,
  cupo         INTEGER,
  estado       TEXT NOT NULL DEFAULT 'activo',
  notas        TEXT,
  created_at   TEXT DEFAULT (datetime('now','localtime'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS curso_sesiones (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  curso_id   INTEGER NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  fecha      TEXT NOT NULL,
  descripcion TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS curso_inscripciones (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  curso_id     INTEGER NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  cliente_id   INTEGER REFERENCES clientes(id),
  nombre_libre TEXT,
  monto_total  REAL NOT NULL DEFAULT 0,
  monto_pagado REAL NOT NULL DEFAULT 0,
  estado_pago  TEXT NOT NULL DEFAULT 'pendiente',
  notas        TEXT,
  created_at   TEXT DEFAULT (datetime('now','localtime'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS curso_gastos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  curso_id    INTEGER NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  monto       REAL NOT NULL,
  fecha       TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now','localtime'))
)`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

module.exports = { db, all, get, run };
