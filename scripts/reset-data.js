'use strict';
require('dotenv').config();
const path     = require('path');
const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'celeste.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');

const reset = db.transaction(() => {
  // Delete all business data
  db.prepare('DELETE FROM venta_items').run();
  db.prepare('DELETE FROM ventas').run();
  db.prepare('DELETE FROM gastos').run();
  db.prepare('DELETE FROM pedidos').run();
  db.prepare('DELETE FROM clientes').run();
  db.prepare('DELETE FROM productos').run();

  // Reset autoincrement counters
  for (const t of ['venta_items','ventas','gastos','pedidos','clientes','productos']) {
    db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(t);
  }

  // Update PINs
  const PIN_ANDRES = process.env.PIN_ANDRES;
  const PIN_SVA    = process.env.PIN_SVA;

  db.prepare("UPDATE users SET pin_hash = ? WHERE email = ?").run(
    bcrypt.hashSync(PIN_ANDRES, 10), 'andresvigo1@hotmail.com'
  );
  db.prepare("UPDATE users SET pin_hash = ? WHERE email = ?").run(
    bcrypt.hashSync(PIN_SVA, 10), 'a.sva.20@outlook.com'
  );

  // Remove all passkeys (user must re-register Face ID)
  db.prepare('DELETE FROM passkeys').run();

  console.log('✓ Data limpiada');
  console.log('✓ PINs actualizados');
  console.log('✓ Passkeys eliminadas (registrar de nuevo en ajustes)');
});

reset();
db.close();
